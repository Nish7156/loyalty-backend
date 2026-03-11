import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, WalletTransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

const WALLET_ENABLED_KEY = 'walletEnabled';
const POINTS_PERCENTAGE_KEY = 'pointsPercentage';
const POINTS_EXPIRY_DAYS_KEY = 'pointsExpiryDays';
const POINTS_TO_REWARD_RATIO_KEY = 'pointsToRewardRatio';
const MINIMUM_REDEMPTION_POINTS_KEY = 'minimumRedemptionPoints';

const DEFAULT_POINTS_PERCENTAGE = 5;
const DEFAULT_POINTS_EXPIRY_DAYS = 365;
const DEFAULT_POINTS_TO_REWARD_RATIO = 100;
const DEFAULT_MINIMUM_REDEMPTION_POINTS = 50;

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private isWalletEnabled(branch: { settings?: Prisma.JsonValue }): boolean {
    const s = branch.settings as Record<string, unknown> | null;
    return s && typeof s[WALLET_ENABLED_KEY] === 'boolean' ? s[WALLET_ENABLED_KEY] : false;
  }

  private getPointsPercentage(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, unknown> | null;
    return s && typeof s[POINTS_PERCENTAGE_KEY] === 'number' ? s[POINTS_PERCENTAGE_KEY] : DEFAULT_POINTS_PERCENTAGE;
  }

  private getPointsExpiryDays(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, unknown> | null;
    return s && typeof s[POINTS_EXPIRY_DAYS_KEY] === 'number' ? s[POINTS_EXPIRY_DAYS_KEY] : DEFAULT_POINTS_EXPIRY_DAYS;
  }

  private getPointsToRewardRatio(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, unknown> | null;
    return s && typeof s[POINTS_TO_REWARD_RATIO_KEY] === 'number' ? s[POINTS_TO_REWARD_RATIO_KEY] : DEFAULT_POINTS_TO_REWARD_RATIO;
  }

  private getMinimumRedemptionPoints(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, unknown> | null;
    return s && typeof s[MINIMUM_REDEMPTION_POINTS_KEY] === 'number' ? s[MINIMUM_REDEMPTION_POINTS_KEY] : DEFAULT_MINIMUM_REDEMPTION_POINTS;
  }

  async getOrCreateWallet(customerId: string, partnerId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: {
        customerId_partnerId: { customerId, partnerId },
      },
      include: { partner: true },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          customerId,
          partnerId,
          balance: new Decimal(0),
          lifetimeEarned: new Decimal(0),
          lifetimeSpent: new Decimal(0),
        },
        include: { partner: true },
      });
    }

    return wallet;
  }

  async addPoints(
    customerId: string,
    partnerId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
    expiryDays?: number,
  ) {
    const wallet = await this.getOrCreateWallet(customerId, partnerId);
    const pointsDecimal = new Decimal(amount);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore.add(pointsDecimal);

    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lifetimeEarned: wallet.lifetimeEarned.add(pointsDecimal),
        },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.EARN,
          amount: pointsDecimal,
          balanceBefore,
          balanceAfter,
          description,
          metadata: metadata ?? undefined,
          expiresAt,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  async deductPoints(
    customerId: string,
    partnerId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
  ) {
    const wallet = await this.getOrCreateWallet(customerId, partnerId);
    const pointsDecimal = new Decimal(amount);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore.sub(pointsDecimal);

    if (balanceAfter.isNegative()) {
      throw new BadRequestException('Insufficient points balance');
    }

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lifetimeSpent: wallet.lifetimeSpent.add(pointsDecimal),
        },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.SPEND,
          amount: pointsDecimal.negated(),
          balanceBefore,
          balanceAfter,
          description,
          metadata: metadata ?? undefined,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  async getBalance(customerId: string, partnerId: string) {
    const wallet = await this.getOrCreateWallet(customerId, partnerId);
    return {
      balance: Number(wallet.balance),
      lifetimeEarned: Number(wallet.lifetimeEarned),
      lifetimeSpent: Number(wallet.lifetimeSpent),
      partnerId: wallet.partnerId,
    };
  }

  async getAllBalances(customerId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { customerId },
      include: { partner: true },
      orderBy: { updatedAt: 'desc' },
    });

    return wallets.map((wallet) => ({
      balance: Number(wallet.balance),
      lifetimeEarned: Number(wallet.lifetimeEarned),
      lifetimeSpent: Number(wallet.lifetimeSpent),
      partnerId: wallet.partnerId,
      partnerName: wallet.partner.businessName,
    }));
  }

  async getTransactions(
    customerId: string,
    partnerId?: string,
    limit = 50,
    offset = 0,
  ) {
    const walletFilter: Prisma.WalletWhereInput = { customerId };
    if (partnerId) walletFilter.partnerId = partnerId;

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { wallet: walletFilter },
      include: {
        wallet: { include: { partner: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      balanceBefore: Number(tx.balanceBefore),
      balanceAfter: Number(tx.balanceAfter),
      description: tx.description,
      metadata: tx.metadata,
      expiresAt: tx.expiresAt,
      createdAt: tx.createdAt,
      partnerId: tx.wallet.partnerId,
      partnerName: tx.wallet.partner.businessName,
    }));
  }

  /**
   * Customer requests reward redemption - creates PENDING reward with code
   * Points are NOT deducted yet - only when staff verifies the code
   */
  async redeemPointsForReward(customerId: string, partnerId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.partnerId !== partnerId) {
      throw new NotFoundException('Branch not found');
    }

    if (!this.isWalletEnabled(branch)) {
      throw new BadRequestException('Wallet is not enabled for this branch');
    }

    const wallet = await this.getOrCreateWallet(customerId, partnerId);
    const pointsToRewardRatio = this.getPointsToRewardRatio(branch);

    const balance = Number(wallet.balance);
    const rewardCount = Math.floor(balance / pointsToRewardRatio);

    // Check if customer has enough points for at least 1 reward
    if (rewardCount === 0) {
      const pointsNeeded = pointsToRewardRatio - balance;
      throw new BadRequestException(
        `You need ${pointsToRewardRatio} points to redeem 1 reward. You have ${balance.toFixed(0)} points (${pointsNeeded.toFixed(0)} more needed).`,
      );
    }

    const pointsToSpend = rewardCount * pointsToRewardRatio;
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create PENDING rewards with redemption code - points NOT deducted yet
    const rewards = await this.prisma.$transaction(async (tx) => {
      const createdRewards: any[] = [];

      for (let i = 0; i < rewardCount; i++) {
        // Generate unique redemption code
        const code = this.generateRedemptionCode();

        const reward = await tx.reward.create({
          data: {
            customerId,
            partnerId,
            status: 'PENDING',  // ← PENDING until staff verifies
            expiryDate: expiry,
            redemptionCode: code,
            redeemedAt: new Date(),  // When customer requested
            pointsCost: pointsToRewardRatio,  // Track points needed
            source: 'POINTS',  // Source: points redemption
          },
        });
        createdRewards.push(reward);
      }

      return createdRewards;
    });

    return {
      success: true,
      pointsToSpend: pointsToSpend,  // Will be deducted when staff approves
      rewardsCreated: rewardCount,
      rewards: rewards,
      remainingBalance: balance,  // Balance unchanged (not deducted yet)
      message: 'Show redemption code(s) to staff for verification',
    };
  }

  /**
   * Generate 8-char unique redemption code
   */
  private generateRedemptionCode(): string {
    const REDEMPTION_CODE_LENGTH = 8;
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = require('crypto').randomBytes(REDEMPTION_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < REDEMPTION_CODE_LENGTH; i++) {
      code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
    }
    return code;
  }

  async processActivityApproval(
    customerId: string,
    branchId: string,
    transactionValue: number,
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { partner: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (!this.isWalletEnabled(branch)) {
      return null;
    }

    const pointsPercentage = this.getPointsPercentage(branch);
    const pointsExpiryDays = this.getPointsExpiryDays(branch);
    const pointsEarned = (transactionValue * pointsPercentage) / 100;

    if (pointsEarned <= 0) {
      return null;
    }

    const result = await this.addPoints(
      customerId,
      branch.partnerId,
      pointsEarned,
      `Earned from ₹${transactionValue} purchase`,
      { branchId, transactionValue },
      pointsExpiryDays,
    );

    return {
      pointsEarned,
      newBalance: Number(result.wallet.balance),
      partnerId: branch.partnerId,
      partnerName: branch.partner.businessName,
    };
  }

  async expirePoints() {
    const now = new Date();
    const expiredTransactions = await this.prisma.walletTransaction.findMany({
      where: {
        type: WalletTransactionType.EARN,
        expiresAt: { lte: now },
        wallet: {
          transactions: {
            none: {
              type: WalletTransactionType.EXPIRE,
              metadata: {
                path: ['expiredTransactionId'],
                equals: undefined,
              },
            },
          },
        },
      },
      include: { wallet: true },
    });

    for (const transaction of expiredTransactions) {
      const wallet = transaction.wallet;
      const expiredAmount = transaction.amount;
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore.sub(expiredAmount);

      if (!balanceAfter.isNegative()) {
        await this.prisma.$transaction([
          this.prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: balanceAfter },
          }),
          this.prisma.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: WalletTransactionType.EXPIRE,
              amount: expiredAmount.negated(),
              balanceBefore,
              balanceAfter,
              description: `Points expired`,
              metadata: { expiredTransactionId: transaction.id },
            },
          }),
        ]);
      }
    }

    return { expiredCount: expiredTransactions.length };
  }
}
