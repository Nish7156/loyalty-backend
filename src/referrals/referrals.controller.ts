import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-code')
  @UseGuards(JwtCustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get or generate customer referral code' })
  async getMyCode(@Request() req: { user: { phoneNumber: string } }) {
    const code = await this.referralsService.getOrCreateCode(req.user.phoneNumber);
    return { code };
  }

  @Get('my-stats')
  @UseGuards(JwtCustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get referral stats (pending, completed, total bonus)' })
  async getMyStats(@Request() req: { user: { phoneNumber: string } }) {
    return this.referralsService.getStats(req.user.phoneNumber);
  }

  @Get('my-list')
  @UseGuards(JwtCustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List people referred (masked phone + status)' })
  async getMyList(@Request() req: { user: { phoneNumber: string } }) {
    return this.referralsService.getList(req.user.phoneNumber);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a referral code to a new customer phone number' })
  async applyCode(@Body() body: { code: string; phone: string }) {
    if (!body.code || !body.phone) {
      throw new BadRequestException('code and phone are required');
    }
    await this.referralsService.applyReferralCode(body.code, body.phone);
    return { success: true };
  }
}
