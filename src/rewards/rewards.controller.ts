import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
import { JwtStaffAuthGuard } from '../auth/guards/jwt-staff.guard';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  findAll() {
    return this.rewardsService.findAll();
  }

  @Get('customer/:customerId')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.rewardsService.findByCustomer(customerId);
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
  findOne(@Param('id') id: string) {
    return this.rewardsService.findOne(id);
  }
}
