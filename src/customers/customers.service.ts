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
