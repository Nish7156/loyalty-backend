import { Injectable, NotFoundException } from '@nestjs/common';
import { Reward, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  async redeem(id: string, customerPhone?: string): Promise<Reward> {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException('Reward not found');
    if (reward.status === 'REDEEMED') {
      throw new NotFoundException('Reward already redeemed');
    }
    if (customerPhone != null && reward.customerId !== customerPhone) {
      throw new NotFoundException('Reward not found');
    }
    return this.prisma.reward.update({
      where: { id },
      data: { status: 'REDEEMED' },
      include: { customer: true, partner: true },
    });
  }
}
