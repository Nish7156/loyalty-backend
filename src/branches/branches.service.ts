import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.branch.create({
      data: {
        branchName: dto.branchName,
        partnerId: dto.partnerId,
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

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.findOne(id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        branchName: dto.branchName,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
        location: dto.location as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(id: string): Promise<Branch> {
    await this.findOne(id);
    return this.prisma.branch.delete({ where: { id } });
  }
}
