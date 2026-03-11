import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(JwtCustomerAuthGuard)
  async getAllBalances(@Req() req: { user: { phone: string } }) {
    return this.walletService.getAllBalances(req.user.phone);
  }

  @Get('balance/:partnerId')
  @UseGuards(JwtCustomerAuthGuard)
  async getBalance(
    @Req() req: { user: { phone: string } },
    @Query('partnerId') partnerId: string,
  ) {
    return this.walletService.getBalance(req.user.phone, partnerId);
  }

  @Get('transactions')
  @UseGuards(JwtCustomerAuthGuard)
  @ApiQuery({ name: 'partnerId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getTransactions(
    @Req() req: { user: { phone: string } },
    @Query('partnerId') partnerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.walletService.getTransactions(req.user.phone, partnerId, limitNum, offsetNum);
  }

  @Post('redeem')
  @UseGuards(JwtCustomerAuthGuard)
  async redeemPoints(
    @Req() req: { user: { phone: string } },
    @Body() body: { partnerId: string; branchId: string },
  ) {
    return this.walletService.redeemPointsForReward(
      req.user.phone,
      body.partnerId,
      body.branchId,
    );
  }
}
