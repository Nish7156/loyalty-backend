import { Injectable, NotFoundException } from '@nestjs/common';
import { Partner, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartnerDto): Promise<Partner> {
    return this.prisma.partner.create({
      data: {
        businessName: dto.businessName,
        industryType: dto.industryType,
        ownerId: dto.ownerId,
      },
    });
  }

  async findAll(args?: Prisma.PartnerFindManyArgs): Promise<Partner[]> {
    return this.prisma.partner.findMany(args);
  }

  async findOne(id: string): Promise<Partner> {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: { branches: true },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async update(id: string, dto: UpdatePartnerDto): Promise<Partner> {
    await this.findOne(id);
    return this.prisma.partner.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<Partner> {
    await this.findOne(id);
    return this.prisma.partner.delete({ where: { id } });
  }
}
