import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartnerDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.ownerPhone },
    });
    if (existing) {
      throw new ConflictException('A user with this phone number already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: { phone: dto.ownerPhone, role: 'PARTNER_OWNER' },
      });
      return tx.partner.create({
        data: { businessName: dto.businessName, industryType: dto.industryType, ownerId: owner.id },
        include: { owner: { select: { phone: true } } },
      });
    });
  }

  async findAll(args?: Prisma.PartnerFindManyArgs) {
    return this.prisma.partner.findMany({
      ...args,
      include: { owner: { select: { phone: true } } },
    });
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: { branches: true, owner: { select: { phone: true } } },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.findOne(id);
    return this.prisma.partner.update({
      where: { id },
      data: dto,
      include: { owner: { select: { phone: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.partner.delete({ where: { id } });
  }
}
