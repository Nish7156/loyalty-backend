import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
import { JwtStaffAuthGuard } from '../auth/guards/jwt-staff.guard';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  @UseGuards(JwtUserAuthGuard)
  findAll() {
    return this.rewardsService.findAll();
  }

  @Get('customer/:customerId')
  @UseGuards(JwtCustomerAuthGuard)
  findByCustomer(@Param('customerId') customerId: string, @Req() req: { user: { phone: string } }) {
    // Customers can only view their own rewards
    return this.rewardsService.findByCustomer(req.user.phone);
  }

  @Patch(':id/redeem')
  @UseGuards(JwtCustomerAuthGuard)
  redeem(@Param('id') id: string, @Req() req: { user: { phone: string } }) {
    return this.rewardsService.redeem(id, req.user.phone);
  }

  @Get('pending-redemptions')
  @UseGuards(JwtStaffAuthGuard)
  getPendingRedemptions(@Req() req: { user: { branchId: string } }) {
    return this.rewardsService.getPendingRedemptionsForStaff(req.user.branchId);
  }

  @Post('complete-by-code')
  @UseGuards(JwtStaffAuthGuard)
  @ApiBody({ schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } })
  completeByCode(@Body('code') code: string, @Req() req: { user: { branchId: string } }) {
    return this.rewardsService.completeByCode(code, req.user.branchId);
  }

  @Get(':id')
  @UseGuards(JwtStaffAuthGuard)
  findOne(@Param('id') id: string) {
    return this.rewardsService.findOne(id);
  }
}
