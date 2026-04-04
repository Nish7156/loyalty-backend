import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

@Injectable()
export class PushScheduler {
  private readonly logger = new Logger(PushScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  // Runs every day at 9:00 AM
  @Cron('0 9 * * *')
  async sendRewardExpiryNotifications(): Promise<void> {
    this.logger.log('Running reward expiry notification job...');

    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 3-day warning
    const expiringSoon = await this.prisma.reward.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          gte: tomorrow,
          lte: in3Days,
        },
      },
      include: {
        partner: { select: { businessName: true } },
      },
    });

    for (const reward of expiringSoon) {
      const daysLeft = Math.ceil(
        (new Date(reward.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      await this.pushService.sendToCustomer(reward.customerId, {
        title: 'Reward Expiring Soon',
        body: `Your reward at ${reward.partner.businessName} expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Use it before it's gone!`,
        tag: `reward-expiry-${reward.id}`,
        url: '/rewards',
        type: 'REWARD_EXPIRING',
        partnerId: reward.partnerId,
      });
    }

    // Today / already expired check (expires in next 24h)
    const expiringToday = await this.prisma.reward.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: {
          gte: now,
          lt: tomorrow,
        },
      },
      include: {
        partner: { select: { businessName: true } },
      },
    });

    for (const reward of expiringToday) {
      await this.pushService.sendToCustomer(reward.customerId, {
        title: 'Last Chance!',
        body: `Your reward at ${reward.partner.businessName} expires today. Redeem it now!`,
        tag: `reward-expiry-today-${reward.id}`,
        url: '/rewards',
        type: 'REWARD_EXPIRING_TODAY',
        partnerId: reward.partnerId,
      });
    }

    this.logger.log(
      `Expiry notifications sent: ${expiringSoon.length} (3-day) + ${expiringToday.length} (today)`,
    );
  }
}
