import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(customerId: string) {
    return this.prisma.platformWallet.upsert({
      where: { customerId },
      create: {
        customerId,
        balance: new Decimal(0),
        lifetimeEarned: new Decimal(0),
        lifetimeSpent: new Decimal(0),
      },
      update: {},
    });
  }

  async earn(customerId: string, amount: number, description: string, metadata?: Record<string, string>): Promise<{ balance: Decimal }> {
    const wallet = await this.getOrCreate(customerId);
    const amountDecimal = new Decimal(amount);
    const balanceBefore = new Decimal(wallet.balance);
    const balanceAfter = balanceBefore.add(amountDecimal);

    await this.prisma.$transaction([
      this.prisma.platformWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lifetimeEarned: new Decimal(wallet.lifetimeEarned).add(amountDecimal),
        },
      }),
      this.prisma.platformWalletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'EARN',
          amount: amountDecimal,
          balanceBefore,
          balanceAfter,
          description,
          metadata: metadata ?? undefined,
        },
      }),
    ]);

    return { balance: balanceAfter };
  }

  async getBalance(customerId: string): Promise<{ balance: number; lifetimeEarned: number; lifetimeSpent: number }> {
    const wallet = await this.prisma.platformWallet.findUnique({ where: { customerId } });
    if (!wallet) return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    return {
      balance: Number(wallet.balance),
      lifetimeEarned: Number(wallet.lifetimeEarned),
      lifetimeSpent: Number(wallet.lifetimeSpent),
    };
  }

  async getTransactions(customerId: string, limit = 50) {
    const wallet = await this.prisma.platformWallet.findUnique({ where: { customerId } });
    if (!wallet) return [];
    const txs = await this.prisma.platformWalletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return txs.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      metadata: t.metadata,
      createdAt: t.createdAt,
    }));
  }
}
