import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('Health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('ping')
  @ApiOperation({ summary: 'Simple ping endpoint' })
  @ApiResponse({ status: 200, description: 'Returns "Alive"' })
  ping(): string {
    return 'Alive';
  }

  @Get('healthz')
  @ApiOperation({ summary: 'Quick health check' })
  @ApiResponse({ status: 200, description: 'Returns "OK"' })
  healthz(): string {
    return 'OK';
  }

  @Get('health')
  @ApiOperation({ summary: 'Comprehensive health check with database status' })
  @ApiResponse({
    status: 200,
    description: 'Returns detailed health information',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2026-03-11T10:30:00.000Z',
        uptime: {
          seconds: 3600,
          formatted: '1h 0m 0s',
        },
        database: {
          status: 'connected',
          latency: '5ms',
        },
        environment: 'development',
        version: '1.0.0',
      },
    },
  })
  async health() {
    return this.appService.getHealth();
  }
}
