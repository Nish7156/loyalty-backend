import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

const REFERRAL_BONUS_REFERRER = 100;
const REFERRAL_BONUS_REFERRED = 50;
const REFERRAL_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += REFERRAL_CHARSET[Math.floor(Math.random() * REFERRAL_CHARSET.length)];
  }
  return code;
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  async getOrCreateCode(customerPhone: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber: customerPhone },
      select: { referralCode: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    if (customer.referralCode) return customer.referralCode;

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 20) throw new BadRequestException('Could not generate unique code');
    } while (await this.prisma.customer.findUnique({ where: { referralCode: code } }));

    await this.prisma.customer.update({
      where: { phoneNumber: customerPhone },
      data: { referralCode: code },
    });

    return code;
  }

  async getStats(customerPhone: string) {
    const [pending, completed, bonusAgg] = await Promise.all([
      this.prisma.referral.count({
        where: { referrerId: customerPhone, status: 'PENDING' },
      }),
      this.prisma.referral.count({
        where: { referrerId: customerPhone, status: 'COMPLETED' },
      }),
      this.prisma.referral.aggregate({
        where: { referrerId: customerPhone, status: 'COMPLETED' },
        _sum: { bonusAwarded: true },
      }),
    ]);

    return {
      pending,
      completed,
      total: pending + completed,
      totalBonus: Number(bonusAgg._sum.bonusAwarded ?? 0),
    };
  }

  async getList(customerPhone: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: customerPhone },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        referredId: true,
        status: true,
        bonusAwarded: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return referrals.map((r) => ({
      ...r,
      referredId: maskPhone(r.referredId),
      bonusAwarded: Number(r.bonusAwarded ?? 0),
    }));
  }

  async applyReferralCode(code: string, newCustomerPhone: string): Promise<void> {
    const referrer = await this.prisma.customer.findUnique({
      where: { referralCode: code },
      select: { phoneNumber: true },
    });

    if (!referrer) throw new NotFoundException('Invalid referral code');

    if (referrer.phoneNumber === newCustomerPhone) {
      throw new BadRequestException('Cannot refer yourself');
    }

    // Check if already referred
    const existing = await this.prisma.referral.findUnique({
      where: { referredId: newCustomerPhone },
    });
    if (existing) return; // silently skip — customer already has a referral

    await this.prisma.$transaction([
      this.prisma.referral.create({
        data: {
          referrerId: referrer.phoneNumber,
          referredId: newCustomerPhone,
          status: 'PENDING',
        },
      }),
      this.prisma.customer.update({
        where: { phoneNumber: newCustomerPhone },
        data: { referredBy: referrer.phoneNumber },
      }),
    ]);
  }

  async completeReferral(referredPhone: string, partnerId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: referredPhone },
    });

    if (!referral || referral.status !== 'PENDING') return;

    const branch = await this.prisma.branch.findFirst({
      where: { partnerId },
      select: { loyaltyType: true },
    });

    const isVisitsOnly = branch?.loyaltyType === 'VISITS';

    if (isVisitsOnly) {
      // Award 1 free streak increment to referrer at this partner
      await this.prisma.$transaction([
        this.prisma.streak.upsert({
          where: { customerId_partnerId: { customerId: referral.referrerId, partnerId } },
          create: { customerId: referral.referrerId, partnerId, currentCount: 1 },
          update: { currentCount: { increment: 1 } },
        }),
        this.prisma.referral.update({
          where: { id: referral.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            partnerId,
            bonusAwarded: REFERRAL_BONUS_REFERRER,
          },
        }),
      ]);
    } else {
      // Award wallet points to referrer and referred
      await this.awardWalletBonus(referral.referrerId, referredPhone, partnerId, referral.id);
    }

    // Send push notifications (non-blocking)
    this.sendReferralNotifications(referral.referrerId, referredPhone).catch(() => {});
  }

  private async awardWalletBonus(
    referrerId: string,
    referredId: string,
    partnerId: string,
    referralId: string,
  ) {
    const now = new Date();

    const zero = new Decimal(0);

    // Referrer wallet
    const referrerWallet = await this.prisma.wallet.upsert({
      where: { customerId_partnerId: { customerId: referrerId, partnerId } },
      create: { customerId: referrerId, partnerId, balance: zero, lifetimeEarned: zero, lifetimeSpent: zero },
      update: {},
    });

    // Referred wallet
    const referredWallet = await this.prisma.wallet.upsert({
      where: { customerId_partnerId: { customerId: referredId, partnerId } },
      create: { customerId: referredId, partnerId, balance: zero, lifetimeEarned: zero, lifetimeSpent: zero },
      update: {},
    });

    const referrerBalanceBefore = new Decimal(referrerWallet.balance);
    const referredBalanceBefore = new Decimal(referredWallet.balance);
    const referrerBonusDecimal = new Decimal(REFERRAL_BONUS_REFERRER);
    const referredBonusDecimal = new Decimal(REFERRAL_BONUS_REFERRED);

    await this.prisma.$transaction([
      // Referrer: earn 100 points
      this.prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          balance: referrerBalanceBefore.add(referrerBonusDecimal),
          lifetimeEarned: new Decimal(referrerWallet.lifetimeEarned).add(referrerBonusDecimal),
        },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: referrerWallet.id,
          type: 'EARN',
          amount: referrerBonusDecimal,
          balanceBefore: referrerBalanceBefore,
          balanceAfter: referrerBalanceBefore.add(referrerBonusDecimal),
          description: `Referral bonus — friend signed up`,
        },
      }),
      // Referred: earn 50 welcome points
      this.prisma.wallet.update({
        where: { id: referredWallet.id },
        data: {
          balance: referredBalanceBefore.add(referredBonusDecimal),
          lifetimeEarned: new Decimal(referredWallet.lifetimeEarned).add(referredBonusDecimal),
        },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: referredWallet.id,
          type: 'EARN',
          amount: referredBonusDecimal,
          balanceBefore: referredBalanceBefore,
          balanceAfter: referredBalanceBefore.add(referredBonusDecimal),
          description: `Welcome bonus — joined via referral`,
        },
      }),
      // Mark referral completed
      this.prisma.referral.update({
        where: { id: referralId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          partnerId,
          bonusAwarded: REFERRAL_BONUS_REFERRER,
        },
      }),
    ]);
  }

  private async sendReferralNotifications(referrerId: string, referredId: string) {
    await Promise.allSettled([
      this.pushService.sendToCustomer(referrerId, {
        title: 'Referral bonus earned!',
        body: `Your friend just checked in for the first time. You earned ${REFERRAL_BONUS_REFERRER} bonus points!`,
        type: 'POINTS_EARNED',
        tag: 'referral-bonus',
      }),
      this.pushService.sendToCustomer(referredId, {
        title: 'Welcome bonus!',
        body: `Welcome! You've earned ${REFERRAL_BONUS_REFERRED} bonus points for joining via referral.`,
        type: 'POINTS_EARNED',
        tag: 'referral-welcome',
      }),
    ]);
  }
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return phone.slice(0, 2) + '****' + phone.slice(-2);
}
