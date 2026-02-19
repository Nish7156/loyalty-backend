import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { isOtpValid } from './dto/register.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(phoneNumber: string): Promise<Customer> {
    let customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { phoneNumber },
      });
    }
    return customer;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    return this.prisma.customer.upsert({
      where: { phoneNumber: dto.phoneNumber },
      create: { phoneNumber: dto.phoneNumber },
      update: {},
    });
  }

  async findAll(args?: Prisma.CustomerFindManyArgs): Promise<Customer[]> {
    return this.prisma.customer.findMany(args);
  }

  async findOne(phoneNumber: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: { streaks: { include: { partner: true } }, rewards: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findByPhone(phoneNumber: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: { streaks: { include: { partner: true } }, rewards: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getProfileByPhone(phoneNumber: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
      include: {
        streaks: { include: { partner: true } },
        rewards: { include: { partner: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const approvedActivities = await this.prisma.activity.findMany({
      where: { customerId: phoneNumber, status: 'APPROVED' },
      include: { branch: { include: { partner: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const byBranch = new Map<
      string,
      { branchId: string; branchName: string; partnerId: string; partnerName: string; visitCount: number; lastVisitAt: Date }
    >();
    for (const a of approvedActivities) {
      const key = a.branchId;
      if (!byBranch.has(key)) {
        byBranch.set(key, {
          branchId: a.branch.id,
          branchName: a.branch.branchName,
          partnerId: a.branch.partner.id,
          partnerName: a.branch.partner.businessName,
          visitCount: 0,
          lastVisitAt: a.createdAt,
        });
      }
      const row = byBranch.get(key)!;
      row.visitCount += 1;
      if (a.createdAt > row.lastVisitAt) row.lastVisitAt = a.createdAt;
    }
    const storesVisited = Array.from(byBranch.values());

    return {
      customer: {
        phoneNumber: customer.phoneNumber,
        streaks: customer.streaks,
        rewards: customer.rewards,
      },
      storesVisited,
    };
  }

  async registerAtBranch(branchId: string, phoneNumber: string, otp: string): Promise<Customer> {
    if (!isOtpValid(otp)) {
      throw new BadRequestException('Invalid OTP');
    }
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { partner: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.findOrCreate(phoneNumber);
  }
}
