import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    let databaseStatus = 'connected';
    let databaseLatency = 0;

    try {
      const startDb = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      databaseLatency = Date.now() - startDb;
    } catch (error) {
      databaseStatus = 'disconnected';
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        formatted: `${hours}h ${minutes}m ${seconds}s`,
      },
      database: {
        status: databaseStatus,
        latency: `${databaseLatency}ms`,
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
