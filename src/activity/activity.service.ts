import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_COOLDOWN_HOURS } from '../common/constants';
import { CustomersService } from '../customers/customers.service';
import { CheckInDto } from './dto/check-in.dto';

const COOLDOWN_KEY = 'cooldownHours';
const STREAK_THRESHOLD_KEY = 'streakThreshold';

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  private getCooldownHours(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, number> | null;
    return (s && typeof s[COOLDOWN_KEY] === 'number') ? s[COOLDOWN_KEY] : DEFAULT_COOLDOWN_HOURS;
  }

  private getStreakThreshold(branch: { settings?: Prisma.JsonValue }): number {
    const s = branch.settings as Record<string, number> | null;
    return (s && typeof s[STREAK_THRESHOLD_KEY] === 'number') ? s[STREAK_THRESHOLD_KEY] : 10;
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
    const cooldownHours = this.getCooldownHours(branch);

    const since = new Date();
    since.setHours(since.getHours() - cooldownHours);
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
        `Cooldown active. Next check-in allowed after ${cooldownHours} hours from last approved visit.`,
      );
    }

    const requestLocation = dto.requestLocation ?? null;
    const locationFlag = this.isDistantScan(requestLocation, branch.location);
    const activity = await this.prisma.activity.create({
      data: {
        customerId: customer.phoneNumber,
        branchId: dto.branchId,
        status: ActivityStatus.PENDING,
        value: dto.value != null ? new Decimal(dto.value) : null,
        requestLocation: requestLocation ?? undefined,
        createdAt: new Date(),
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

  async approveOrReject(activityId: string, status: 'APPROVED' | 'REJECTED', staffId: string) {
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
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.activity.update({
        where: { id: activityId },
        data: { status: ActivityStatus.APPROVED, staffId },
        include: { customer: true, branch: true },
      });

      const streak = await tx.streak.upsert({
        where: {
          customerId_partnerId: {
            customerId: activity.customerId,
            partnerId: activity.branch.partnerId,
          },
        },
        create: {
          customerId: activity.customerId,
          partnerId: activity.branch.partnerId,
          currentCount: 1,
          lastActivityAt: new Date(),
        },
        update: {
          currentCount: { increment: 1 },
          lastActivityAt: new Date(),
        },
      });

      let reward: { id: string; customerId: string; partnerId: string; status: string; expiryDate: Date | null; createdAt: Date } | null = null;
      if (streak.currentCount >= threshold) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);
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
          data: { currentCount: 0 },
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
