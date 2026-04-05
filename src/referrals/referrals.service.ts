import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { PlatformWalletService } from '../platform-wallet/platform-wallet.service';

// Referral bonuses are funded by the loyalty platform — NOT the shop owner
const REFERRAL_BONUS_REFERRER = 100; // platform coins awarded to the person who shared
const REFERRAL_BONUS_REFERRED = 50;  // platform coins awarded to the new user who signed up
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
    private readonly platformWallet: PlatformWalletService,
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
    const [pending, completed, bonusAgg, platformBalance] = await Promise.all([
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
      this.platformWallet.getBalance(customerPhone),
    ]);

    return {
      pending,
      completed,
      total: pending + completed,
      totalBonus: Number(bonusAgg._sum.bonusAwarded ?? 0),
      platformBalance: platformBalance.balance,
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

  /**
   * Called after a referred customer's FIRST ever approved check-in.
   * Awards platform coins to both parties — charged to the loyalty platform, NOT the shop owner.
   */
  async completeReferral(referredPhone: string, _partnerId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: referredPhone },
    });

    if (!referral || referral.status !== 'PENDING') return;

    // Award platform coins to referrer (100) and referred (50)
    // These come from the loyalty platform budget — the shop owner is not charged
    await Promise.all([
      this.platformWallet.earn(
        referral.referrerId,
        REFERRAL_BONUS_REFERRER,
        'Referral bonus — your friend signed up',
        { referredId: referredPhone, referralId: referral.id },
      ),
      this.platformWallet.earn(
        referredPhone,
        REFERRAL_BONUS_REFERRED,
        'Welcome bonus — joined via referral',
        { referrerId: referral.referrerId, referralId: referral.id },
      ),
    ]);

    // Mark referral as completed
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        bonusAwarded: REFERRAL_BONUS_REFERRER,
      },
    });

    // Send push notifications (non-blocking)
    this.sendReferralNotifications(referral.referrerId, referredPhone).catch(() => {});
  }

  private async sendReferralNotifications(referrerId: string, referredId: string) {
    await Promise.allSettled([
      this.pushService.sendToCustomer(referrerId, {
        title: 'Referral bonus earned!',
        body: `Your friend just checked in for the first time. You earned ${REFERRAL_BONUS_REFERRER} platform coins!`,
        type: 'POINTS_EARNED',
        tag: 'referral-bonus',
      }),
      this.pushService.sendToCustomer(referredId, {
        title: 'Welcome bonus!',
        body: `Welcome! You've earned ${REFERRAL_BONUS_REFERRED} platform coins for joining via referral.`,
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
