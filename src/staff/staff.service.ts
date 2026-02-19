import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

type UserWithPartners = { id: string; role: string; ownedPartners: { id: string }[] };

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto, user?: UserWithPartners) {
    if (user) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
        include: { partner: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const isOwner = user.ownedPartners?.some((p) => p.id === branch.partnerId);
      if (!isSuperAdmin && !isOwner) {
        throw new ForbiddenException('Not allowed to create staff for this branch');
      }
    }
    return this.prisma.staff.create({
      data: { name: dto.name, phone: dto.phone, branchId: dto.branchId },
      select: { id: true, name: true, phone: true, branchId: true },
    });
  }

  async findAll(args?: Prisma.StaffFindManyArgs) {
    return this.prisma.staff.findMany({
      ...args,
      select: { id: true, name: true, phone: true, branchId: true, branch: true },
    });
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: { branch: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    const { password: _, ...rest } = staff;
    return rest;
  }

  async update(id: string, dto: UpdateStaffDto) {
    await this.findOne(id);
    const staff = await this.prisma.staff.update({
      where: { id },
      data: { name: dto.name, phone: dto.phone },
      select: { id: true, name: true, phone: true, branchId: true },
    });
    return staff;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.staff.delete({ where: { id } });
  }
}
