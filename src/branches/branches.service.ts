import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate branch settings to prevent configuration conflicts
   */
  private validateSettings(settings: Record<string, any> | null | undefined): void {
    if (!settings) return;

    // Check for cooldown configuration conflict
    const hasCooldownHours = typeof settings.cooldownHours === 'number';
    const hasCooldownMinutes = typeof settings.cooldownMinutes === 'number';

    if (hasCooldownHours && hasCooldownMinutes) {
      throw new BadRequestException(
        'Cannot set both cooldownHours and cooldownMinutes. Please use only one cooldown setting.'
      );
    }

    // Validate cooldown values are positive
    if (hasCooldownHours && settings.cooldownHours < 0) {
      throw new BadRequestException('cooldownHours must be a positive number');
    }

    if (hasCooldownMinutes && settings.cooldownMinutes < 0) {
      throw new BadRequestException('cooldownMinutes must be a positive number');
    }

    // Validate other common settings
    if (settings.streakThreshold !== undefined && settings.streakThreshold <= 0) {
      throw new BadRequestException('streakThreshold must be greater than 0');
    }

    if (settings.rewardWindowDays !== undefined && settings.rewardWindowDays <= 0) {
      throw new BadRequestException('rewardWindowDays must be greater than 0');
    }

    if (settings.pointsPercentage !== undefined && (settings.pointsPercentage < 0 || settings.pointsPercentage > 100)) {
      throw new BadRequestException('pointsPercentage must be between 0 and 100');
    }

    if (settings.amountPerCoin !== undefined && settings.amountPerCoin <= 0) {
      throw new BadRequestException('amountPerCoin must be greater than 0 (e.g. 10 means ₹10 = 1 coin)');
    }

    if (settings.pointsExpiryDays !== undefined && settings.pointsExpiryDays <= 0) {
      throw new BadRequestException('pointsExpiryDays must be greater than 0');
    }

    if (settings.pointsToRewardRatio !== undefined && settings.pointsToRewardRatio <= 0) {
      throw new BadRequestException('pointsToRewardRatio must be greater than 0');
    }

    if (settings.minimumRedemptionPoints !== undefined && settings.minimumRedemptionPoints < 0) {
      throw new BadRequestException('minimumRedemptionPoints must be 0 or greater');
    }
  }

  async create(dto: CreateBranchDto, user?: User): Promise<Branch> {
    if (user?.role === 'PARTNER_OWNER') {
      const partner = await this.prisma.partner.findUnique({
        where: { id: dto.partnerId },
      });
      if (!partner) throw new NotFoundException('Partner not found');
      if (partner.ownerId !== user.id) {
        throw new ForbiddenException('You can only create branches for your own store');
      }
    }

    // Validate settings before creating branch
    this.validateSettings(dto.settings as Record<string, any> | null | undefined);

    return this.prisma.branch.create({
      data: {
        branchName: dto.branchName,
        partnerId: dto.partnerId,
        loyaltyType: dto.loyaltyType,
        settings: (dto.settings ?? undefined) as Prisma.InputJsonValue,
        location: (dto.location ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(user: User): Promise<Branch[]> {
    const where: Prisma.BranchWhereInput =
      user.role === 'PARTNER_OWNER' ? { partner: { ownerId: user.id } } : {};
    return this.prisma.branch.findMany({ where });
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { partner: true, staff: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, user?: User): Promise<Branch> {
    const branch = await this.findOne(id);

    // Check if settings are locked and user is trying to change them
    if (branch.settingsLocked && user?.role === 'PARTNER_OWNER') {
      // Partner owners cannot change locked settings
      if (dto.loyaltyType !== undefined || dto.settings !== undefined) {
        throw new ForbiddenException(
          'Branch settings are locked. Contact admin to make changes.',
        );
      }
    }

    // Only admins can change settingsLocked field
    const dataToUpdate: Prisma.BranchUpdateInput = {
      branchName: dto.branchName,
      location: dto.location as Prisma.InputJsonValue | undefined,
    };

    // Only allow loyalty type and settings changes if not locked or user is admin
    if (!branch.settingsLocked || user?.role === 'SUPER_ADMIN') {
      // Validate settings before updating
      if (dto.settings !== undefined) {
        this.validateSettings(dto.settings as Record<string, any> | null | undefined);
      }
      dataToUpdate.loyaltyType = dto.loyaltyType;
      dataToUpdate.settings = dto.settings as Prisma.InputJsonValue | undefined;
    }

    // Only admins can change the lock status
    if (user?.role === 'SUPER_ADMIN' && dto.settingsLocked !== undefined) {
      dataToUpdate.settingsLocked = dto.settingsLocked;
    }

    return this.prisma.branch.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async remove(id: string): Promise<Branch> {
    await this.findOne(id);
    return this.prisma.branch.delete({ where: { id } });
  }
}
