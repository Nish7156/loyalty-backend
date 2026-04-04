import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  url?: string;
  type?: string;
  partnerId?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
}

// Per-type notification config: vibrate pattern, requireInteraction, action buttons
const TYPE_CONFIG: Record<string, {
  vibrate: number[];
  requireInteraction: boolean;
  actions: { action: string; title: string }[];
}> = {
  CHECKIN_APPROVED: {
    vibrate: [100, 50, 100, 50, 200],
    requireInteraction: false,
    actions: [{ action: 'view', title: '🎯 View progress' }],
  },
  REWARD_EARNED: {
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: true,
    actions: [
      { action: 'redeem', title: '🎁 Redeem now' },
      { action: 'later', title: 'Later' },
    ],
  },
  REWARD_EXPIRING: {
    vibrate: [300, 100, 300],
    requireInteraction: true,
    actions: [
      { action: 'redeem', title: '⚡ Use before it expires' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  },
  POINTS_EARNED: {
    vibrate: [80, 40, 80],
    requireInteraction: false,
    actions: [{ action: 'wallet', title: '💰 View wallet' }],
  },
  PROMOTION: {
    vibrate: [100, 50, 100],
    requireInteraction: false,
    actions: [{ action: 'view', title: '✨ See offer' }],
  },
};

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@loyaltyapp.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY!;
  }

  async subscribe(customerId: string, dto: SubscribeDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        customerId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        customerId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
  }

  async unsubscribe(customerId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { customerId, endpoint },
    });
  }

  /**
   * Send a push notification to all subscriptions belonging to a customer.
   * Returns the number of subscriptions that accepted delivery.
   */
  async sendToCustomer(customerId: string, payload: PushPayload): Promise<number> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { customerId },
    });

    if (subscriptions.length === 0) return 0;

    const type = payload.type ?? 'GENERIC';
    const cfg = TYPE_CONFIG[type];

    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? '/icon-192.png',
      badge: payload.badge ?? '/badge-72.png',
      image: payload.image,
      tag: payload.tag ?? `loyalty-${type.toLowerCase()}`,
      renotify: true,
      timestamp: Date.now(),
      vibrate: cfg?.vibrate ?? [100, 50, 100],
      requireInteraction: payload.requireInteraction ?? cfg?.requireInteraction ?? false,
      actions: payload.actions ?? cfg?.actions ?? [],
      data: {
        url: payload.url ?? '/',
        type,
        partnerId: payload.partnerId,
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        ),
      ),
    );

    // Clean up expired/gone subscriptions (410 or 404)
    const expiredEndpoints: string[] = [];
    let successCount = 0;

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        const err = result.reason as webpush.WebPushError;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        } else {
          this.logger.warn(`Push failed for ${subscriptions[i].customerId}: ${String(err)}`);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
    }

    return successCount;
  }

  /**
   * Broadcast to all customers who have a push subscription AND have ever
   * interacted with this partner (via activity, reward, streak, or wallet).
   * Uses pushSubscription table directly — does NOT depend on streak count > 0.
   */
  async broadcastToPartnerCustomers(
    partnerId: string,
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number; subscribers: number }> {
    // Collect all branch IDs for this partner
    const branches = await this.prisma.branch.findMany({
      where: { partnerId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    if (branchIds.length === 0) {
      return { sent: 0, failed: 0, subscribers: 0 };
    }

    // Find all push subscriptions whose customer has ANY activity at this partner's branches
    // OR has a reward/wallet entry — covers customers even if streaks were reset/deleted
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        customer: {
          OR: [
            { activities: { some: { branchId: { in: branchIds } } } },
            { rewards: { some: { partnerId } } },
            { wallets: { some: { partnerId } } },
          ],
        },
      },
    });

    const uniqueByCustomer = deduplicateByCustomer(subscriptions);
    const subscriberCount = uniqueByCustomer.length;

    let sent = 0;
    let failed = 0;

    await Promise.all(
      uniqueByCustomer.map(async (customerId) => {
        try {
          const count = await this.sendToCustomer(customerId, payload);
          sent += count;
        } catch {
          failed++;
        }
      }),
    );

    return { sent, failed, subscribers: subscriberCount };
  }

  /**
   * Broadcast to ALL customers with a push subscription.
   */
  async broadcastToAll(payload: PushPayload): Promise<{ sent: number; failed: number; subscribers: number }> {
    const rows = await this.prisma.pushSubscription.findMany({
      select: { customerId: true },
      distinct: ['customerId'],
    });

    const subscriberCount = rows.length;
    let sent = 0;
    let failed = 0;

    await Promise.all(
      rows.map(async ({ customerId }) => {
        try {
          const count = await this.sendToCustomer(customerId, payload);
          sent += count;
        } catch {
          failed++;
        }
      }),
    );

    return { sent, failed, subscribers: subscriberCount };
  }

  /**
   * Returns the number of customers with push subscriptions for a given partner.
   * Used to show the owner how many customers will receive a notification.
   */
  async getPartnerSubscriberCount(partnerId: string): Promise<number> {
    const branches = await this.prisma.branch.findMany({
      where: { partnerId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);
    if (branchIds.length === 0) return 0;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        customer: {
          OR: [
            { activities: { some: { branchId: { in: branchIds } } } },
            { rewards: { some: { partnerId } } },
            { wallets: { some: { partnerId } } },
          ],
        },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    return subscriptions.length;
  }

  async getAllSubscriberCount(): Promise<number> {
    return this.prisma.pushSubscription.count({
      // distinct not available on count, use groupBy approach
    }).then(() =>
      this.prisma.pushSubscription
        .findMany({ select: { customerId: true }, distinct: ['customerId'] })
        .then((rows) => rows.length),
    );
  }
}

// Helper: unique customer IDs from subscription rows
function deduplicateByCustomer(
  subs: Array<{ customerId: string }>,
): string[] {
  return [...new Set(subs.map((s) => s.customerId))];
}
