import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Reward, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

const REDEMPTION_CODE_LENGTH = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRedemptionCode(): string {
  const bytes = crypto.randomBytes(REDEMPTION_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < REDEMPTION_CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(args?: Prisma.RewardFindManyArgs): Promise<Reward[]> {
    return this.prisma.reward.findMany(args);
  }

  async findOne(id: string): Promise<Reward> {
    const reward = await this.prisma.reward.findUnique({
      where: { id },
      include: { customer: true, partner: true },
    });
    if (!reward) throw new NotFoundException('Reward not found');
    return reward;
  }

  async findByCustomer(customerId: string): Promise<Reward[]> {
    return this.prisma.reward.findMany({
      where: { customerId },
      include: { partner: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Customer redeems VISITS-based reward (ACTIVE → PENDING with code)
   * For POINTS-based rewards, use wallet.redeemPointsForReward() instead
   */
  async redeem(id: string, customerPhone?: string): Promise<Reward> {
    const reward = await this.prisma.reward.findUnique({ where: { id } });

    if (!reward) throw new NotFoundException('Reward not found');

    // Check expiry
    if (reward.expiryDate && new Date() > reward.expiryDate) {
      throw new BadRequestException('This reward has expired');
    }

    if (reward.status === 'REDEEMED' || reward.status === 'PENDING') {
      throw new BadRequestException('Reward already redeemed');
    }

    if (customerPhone != null && reward.customerId !== customerPhone) {
      throw new NotFoundException('Reward not found');
    }

    const code = generateRedemptionCode();

    return this.prisma.reward.update({
      where: { id },
      data: {
        status: 'PENDING',  // PENDING until staff verifies
        redeemedAt: new Date(),
        redemptionCode: code,
      },
      include: { customer: true, partner: true, redeemedBranch: true },
    });
  }

  async getPendingRedemptionsForStaff(branchId: string): Promise<Reward[]> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { partnerId: true },
    });
    if (!branch) return [];
    return this.prisma.reward.findMany({
      where: {
        partnerId: branch.partnerId,
        status: 'PENDING',  // Only PENDING rewards (awaiting staff approval)
        redemptionCode: { not: null },
        redemptionCompletedAt: null,
      },
      include: { customer: true, partner: true },
      orderBy: { redeemedAt: 'desc' },
    });
  }

  async completeByCode(code: string, staffBranchId: string): Promise<Reward> {
    const trimmed = code?.trim()?.toUpperCase();
    if (!trimmed) throw new BadRequestException('Code is required');

    const reward = await this.prisma.reward.findUnique({
      where: { redemptionCode: trimmed },
      include: {
        partner: { include: { branches: true } },
        customer: true,
      },
    });

    if (!reward) throw new NotFoundException('Invalid or expired code');

    // Check expiry
    if (reward.expiryDate && new Date() > reward.expiryDate) {
      throw new BadRequestException('This reward has expired');
    }

    if (reward.redemptionCompletedAt) {
      throw new BadRequestException('Reward already claimed');
    }

    // Verify staff can complete this reward
    const branchIds = reward.partner.branches.map((b) => b.id);
    if (!branchIds.includes(staffBranchId)) {
      throw new BadRequestException('You cannot complete this reward at your branch');
    }

    // Complete the reward - Points already deducted during redemption request
    // Staff verification just confirms the reward was given to customer
    return this.prisma.reward.update({
      where: { id: reward.id },
      data: {
        status: 'REDEEMED',  // Mark as fully redeemed
        redemptionCompletedAt: new Date(),  // When staff verified
        redeemedBranchId: staffBranchId,  // Track which branch redeemed
      },
      include: { customer: true, partner: true, redeemedBranch: true },
    });
  }
}
