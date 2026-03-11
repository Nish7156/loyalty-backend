import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { getOtp, getAndClearOtp } from '../auth/otp.store';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  async findOrCreate(phoneNumber: string): Promise<Customer> {
    let customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { phoneNumber },
      });
    }
    return customer;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    return this.prisma.customer.upsert({
      where: { phoneNumber: dto.phoneNumber },
      create: { phoneNumber: dto.phoneNumber },
      update: {},
    });
  }

  async findAll(args?: Prisma.CustomerFindManyArgs): Promise<Customer[]> {
    return this.prisma.customer.findMany(args);
  }

  async findOne(phoneNumber: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: { streaks: { include: { partner: true } }, rewards: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findByPhone(phoneNumber: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: { streaks: { include: { partner: true } }, rewards: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getProfileByPhone(phoneNumber: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: {
        streaks: { include: { partner: true } },
        rewards: { include: { partner: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const approvedActivities = await this.prisma.activity.findMany({
      where: { customerId: phoneNumber, status: 'APPROVED' },
      include: { branch: { include: { partner: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const DEFAULT_REWARD_WINDOW_DAYS = 30;
    const DEFAULT_REWARD_DESCRIPTION = 'Free reward';
    const byBranch = new Map<
      string,
      {
        branchId: string;
        branchName: string;
        partnerId: string;
        partnerName: string;
        visitCount: number;
        lastVisitAt: Date;
        loyaltyType?: string;
        rewardThreshold?: number;
        rewardWindowDays?: number;
        rewardDescription?: string;
      }
    >();
    for (const a of approvedActivities) {
      const key = a.branchId;
      if (!byBranch.has(key)) {
        const settings = (a.branch.settings as Record<string, unknown>) ?? {};
        const rewardThreshold = typeof settings.streakThreshold === 'number' ? settings.streakThreshold : undefined;
        const rewardWindowDays =
          typeof settings.rewardWindowDays === 'number' ? settings.rewardWindowDays : DEFAULT_REWARD_WINDOW_DAYS;
        const rewardDescription =
          typeof settings.rewardDescription === 'string' ? settings.rewardDescription : DEFAULT_REWARD_DESCRIPTION;
        byBranch.set(key, {
          branchId: a.branch.id,
          branchName: a.branch.branchName,
          partnerId: a.branch.partner.id,
          partnerName: a.branch.partner.businessName,
          visitCount: 0,
          lastVisitAt: a.createdAt,
          loyaltyType: a.branch.loyaltyType || 'VISITS',
          rewardThreshold,
          rewardWindowDays,
          rewardDescription,
        });
      }
      const row = byBranch.get(key)!;
      row.visitCount += 1;
      if (a.createdAt > row.lastVisitAt) row.lastVisitAt = a.createdAt;
    }
    const storesWithRule = Array.from(byBranch.values());
    const storesVisited = storesWithRule.map((store) => {
      const streak = customer.streaks.find((s) => s.partnerId === store.partnerId);
      return {
        ...store,
        lastVisitAt: store.lastVisitAt,
        streakCurrentCount: streak?.currentCount,
        streakLastActivityAt: streak?.lastActivityAt ?? null,
      };
    });

    const walletBalances = await this.walletService.getAllBalances(phoneNumber);

    return {
      customer: {
        phoneNumber: customer.phoneNumber,
        name: customer.name ?? null,
        streaks: customer.streaks,
        rewards: customer.rewards,
      },
      storesVisited,
      wallets: walletBalances,
    };
  }

  async getMyRequestsByPhone(phoneNumber: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const activities = await this.prisma.activity.findMany({
      where: { customerId: phoneNumber },
      include: { branch: { include: { partner: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return activities.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      branchId: a.branchId,
      staffId: a.staffId,
      status: a.status,
      value: a.value != null ? Number(a.value) : null,
      customerName: a.customerName ?? null,
      createdAt: a.createdAt,
      branch: a.branch,
      partner: a.branch.partner,
    }));
  }

  async getHistoryByPhone(phoneNumber: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [activities, redeemedRewards] = await Promise.all([
      this.prisma.activity.findMany({
        where: { customerId: phoneNumber, status: 'APPROVED' },
        include: { branch: { include: { partner: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.reward.findMany({
        where: { customerId: phoneNumber, status: 'REDEEMED' },
        include: { partner: true, redeemedBranch: true },
        orderBy: { redeemedAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      activities: activities.map((a) => ({
        id: a.id,
        customerId: a.customerId,
        branchId: a.branchId,
        staffId: a.staffId,
        status: a.status,
        value: a.value != null ? Number(a.value) : null,
        customerName: a.customerName ?? null,
        createdAt: a.createdAt,
        branch: a.branch,
        partner: a.branch.partner,
      })),
      redeemedRewards: redeemedRewards.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        partnerId: r.partnerId,
        status: r.status,
        expiryDate: r.expiryDate,
        createdAt: r.createdAt,
        redeemedAt: r.redeemedAt,
        redeemedBranchId: r.redeemedBranchId,
        partner: r.partner,
        redeemedBranch: r.redeemedBranch,
      })),
    };
  }

  async registerAtBranch(branchId: string, phoneNumber: string, otp: string, name: string): Promise<Customer> {
    const record = getOtp(phoneNumber);
    if (!record || record.type !== 'customer' || record.code !== otp) {
      throw new BadRequestException('Invalid OTP');
    }
    if (new Date() > record.expiresAt) {
      getAndClearOtp(phoneNumber);
      throw new BadRequestException('OTP expired');
    }
    getAndClearOtp(phoneNumber);
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { partner: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    const trimmedName = name.trim().slice(0, 200) || null;
    return this.prisma.customer.upsert({
      where: { phoneNumber },
      create: { phoneNumber, name: trimmedName },
      update: { name: trimmedName },
    });
  }
}
