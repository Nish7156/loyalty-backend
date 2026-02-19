import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Staff, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

type UserWithPartners = { id: string; role: string; ownedPartners: { id: string }[] };

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto, user?: UserWithPartners): Promise<Omit<Staff, 'password'>> {
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
    const hashed = await bcrypt.hash(dto.password, 10);
    const staff = await this.prisma.staff.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        password: hashed,
        branchId: dto.branchId,
      },
    });
    const { password: _, ...rest } = staff;
    return rest;
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
    const data: Prisma.StaffUpdateInput = { name: dto.name, phone: dto.phone };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    const staff = await this.prisma.staff.update({
      where: { id },
      data,
    });
    const { password: _, ...rest } = staff;
    return rest;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.staff.delete({ where: { id } });
  }
}
