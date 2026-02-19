import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rewardsService.findOne(id);
  }

  @Patch(':id/redeem')
  @UseGuards(JwtCustomerAuthGuard)
  redeem(@Param('id') id: string, @Req() req: { user: { phone: string } }) {
    return this.rewardsService.redeem(id, req.user.phone);
  }
}
