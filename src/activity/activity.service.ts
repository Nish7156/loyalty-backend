import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_COOLDOWN_HOURS } from '../common/constants';
import { CustomersService } from '../customers/customers.service';
import { CheckInDto } from './dto/check-in.dto';

const COOLDOWN_HOURS_KEY = 'cooldownHours';
const COOLDOWN_MINUTES_KEY = 'cooldownMinutes';
const STREAK_THRESHOLD_KEY = 'streakThreshold';
const REWARD_WINDOW_DAYS_KEY = 'rewardWindowDays';
const REWARD_DESCRIPTION_KEY = 'rewardDescription';

const DEFAULT_REWARD_WINDOW_DAYS = 30;
const DEFAULT_REWARD_DESCRIPTION = 'Free reward';

/** All date logic uses server/DB timestamps only. Never use client-supplied dates (user can change device time). */

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  /** Cooldown in minutes. Reads cooldownMinutes, else cooldownHours * 60, else default. Capped at 48h. */
  private getCooldownMinutes(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, number> | null;
    if (s && typeof s[COOLDOWN_MINUTES_KEY] === 'number')
      return Math.max(0, Math.min(48 * 60, s[COOLDOWN_MINUTES_KEY]));
    if (s && typeof s[COOLDOWN_HOURS_KEY] === 'number')
      return Math.max(0, Math.min(48 * 60, s[COOLDOWN_HOURS_KEY] * 60));
    return DEFAULT_COOLDOWN_HOURS * 60;
  }

  private formatCooldown(totalMinutes: number): string {
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  private getStreakThreshold(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, unknown> | null;
    return (s && typeof s[STREAK_THRESHOLD_KEY] === 'number') ? s[STREAK_THRESHOLD_KEY] : 10;
  }

  private getRewardWindowDays(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, unknown> | null;
    return (s && typeof s[REWARD_WINDOW_DAYS_KEY] === 'number') ? s[REWARD_WINDOW_DAYS_KEY] : DEFAULT_REWARD_WINDOW_DAYS;
  }

  private getRewardDescription(branch: { settings?: Prisma.JsonValue }): string {
    const s = branch.settings as Record<string, unknown> | null;
    return (s && typeof s[REWARD_DESCRIPTION_KEY] === 'string') ? s[REWARD_DESCRIPTION_KEY] : DEFAULT_REWARD_DESCRIPTION;
  }

  private isDistantScan(
    requestLocation: { lat: number; lng: number } | null,
    branchLocation: Prisma.JsonValue,
  ): boolean {
    if (!requestLocation || !branchLocation) return false;
    const loc = branchLocation as { lat?: number; lng?: number };
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return false;
    const R = 6371e3;
    const φ1 = (loc.lat * Math.PI) / 180;
    const φ2 = (requestLocation.lat * Math.PI) / 180;
    const Δφ = ((requestLocation.lat - loc.lat) * Math.PI) / 180;
    const Δλ = ((requestLocation.lng - loc.lng) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;
    return distanceMeters > 500;
  }

  async checkIn(dto: CheckInDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
      include: { partner: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const customer = await this.customersService.findOrCreate(dto.phoneNumber);
    const partnerId = branch.partnerId;
    const cooldownMinutes = this.getCooldownMinutes(branch);

    if (cooldownMinutes > 0) {
      const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);
      const recentApproved = await this.prisma.activity.findFirst({
        where: {
          customerId: customer.phoneNumber,
          branch: { partnerId },
          status: ActivityStatus.APPROVED,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentApproved) {
        throw new BadRequestException(
          `Cooldown active. Next check-in allowed after ${this.formatCooldown(cooldownMinutes)} from last approved visit.`,
        );
      }
    }

    const requestLocation = dto.requestLocation ?? null;
    const locationFlag = this.isDistantScan(requestLocation, branch.location);
    const customerName = typeof dto.customerName === 'string' ? dto.customerName.trim().slice(0, 200) : null;
    const activity = await this.prisma.activity.create({
      data: {
        customerId: customer.phoneNumber,
        branchId: dto.branchId,
        status: ActivityStatus.PENDING,
        value: dto.value != null ? new Decimal(dto.value) : null,
        customerName: customerName || undefined,
        requestLocation: requestLocation ?? undefined,
      },
      include: {
        customer: true,
        branch: { include: { partner: true } },
      },
    });
    return {
      ...activity,
      value: activity.value ? Number(activity.value) : null,
      locationFlagDistant: locationFlag,
    };
  }

  async approveOrReject(activityId: string, status: 'APPROVED' | 'REJECTED', staffId: string, value?: number) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { branch: { include: { partner: true } }, customer: true },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    if (activity.status !== ActivityStatus.PENDING) {
      throw new BadRequestException('Activity is not pending');
    }

    if (status === ActivityStatus.REJECTED) {
      return this.prisma.activity.update({
        where: { id: activityId },
        data: { status: ActivityStatus.REJECTED, staffId },
        include: { customer: true, branch: true },
      });
    }

    const threshold = this.getStreakThreshold(activity.branch);
    const windowDays = this.getRewardWindowDays(activity.branch);
    const serverNow = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updateData: { status: ActivityStatus; staffId: string; value?: Decimal } = {
        status: ActivityStatus.APPROVED,
        staffId,
      };
      if (value != null) updateData.value = new Decimal(value);
      const updated = await tx.activity.update({
        where: { id: activityId },
        data: updateData,
        include: { customer: true, branch: true },
      });

      const existing = await tx.streak.findUnique({
        where: {
          customerId_partnerId: {
            customerId: activity.customerId,
            partnerId: activity.branch.partnerId,
          },
        },
      });

      const periodEnd = existing?.lastActivityAt
        ? new Date(existing.lastActivityAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
        : null;
      const periodExpired = periodEnd ? serverNow > periodEnd : true;

      let streak: { id: string; currentCount: number; lastActivityAt: Date | null };
      if (!existing) {
        streak = await tx.streak.create({
          data: {
            customerId: activity.customerId,
            partnerId: activity.branch.partnerId,
            currentCount: 1,
            lastActivityAt: serverNow,
          },
        });
      } else if (periodExpired) {
        streak = await tx.streak.update({
          where: { id: existing.id },
          data: { currentCount: 1, lastActivityAt: serverNow },
        });
      } else {
        streak = await tx.streak.update({
          where: { id: existing.id },
          data: { currentCount: { increment: 1 }, lastActivityAt: serverNow },
        });
      }

      let reward: { id: string; customerId: string; partnerId: string; status: string; expiryDate: Date | null; createdAt: Date } | null = null;
      if (streak.currentCount >= threshold) {
        const expiry = new Date(serverNow.getTime());
        expiry.setDate(expiry.getDate() + 30);
        reward = await tx.reward.create({
          data: {
            customerId: activity.customerId,
            partnerId: activity.branch.partnerId,
            status: 'ACTIVE',
            expiryDate: expiry,
          },
        });
        await tx.streak.update({
          where: { id: streak.id },
          data: { currentCount: 0, lastActivityAt: serverNow },
        });
      }

      return { activity: updated, streak, reward };
    });

    return {
      ...result.activity,
      value: result.activity.value ? Number(result.activity.value) : null,
      streak: result.streak,
      rewardCreated: result.reward != null,
      reward: result.reward,
    };
  }

  async findAll(args?: Prisma.ActivityFindManyArgs) {
    return this.prisma.activity.findMany({
      ...args,
      include: args?.include ?? { customer: true, branch: true, staff: true },
    });
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { customer: true, branch: { include: { partner: true } }, staff: true },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }
}
