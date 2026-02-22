import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Feedback } from '@prisma/client';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, message: string): Promise<Feedback> {
    return this.prisma.feedback.create({
      data: { customerId, message },
    });
  }

  async findAll(): Promise<(Feedback & { customer?: { phoneNumber: string; name: string | null } })[]> {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { phoneNumber: true, name: true } } },
    });
  }
}
