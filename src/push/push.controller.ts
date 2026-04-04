import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { SendPromotionDto } from './dto/send-promotion.dto';
import { SubscribeDto } from './dto/subscribe.dto';
import { PushService } from './push.service';

interface CustomerRequest extends Request {
  user: { phone: string };
}

interface UserRequest extends Request {
  user: { id: string; role: string };
}

@ApiTags('Push Notifications')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for frontend subscription' })
  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtCustomerAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save push subscription for authenticated customer' })
  async subscribe(
    @Req() req: CustomerRequest,
    @Body() dto: SubscribeDto,
  ): Promise<void> {
    await this.pushService.subscribe(req.user.phone, dto);
  }

  @Delete('unsubscribe')
  @UseGuards(JwtCustomerAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove push subscription for authenticated customer' })
  async unsubscribe(
    @Req() req: CustomerRequest,
    @Body() body: { endpoint: string },
  ): Promise<void> {
    await this.pushService.unsubscribe(req.user.phone, body.endpoint);
  }

  @Get('subscribers')
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'partnerId', required: false })
  @ApiOperation({ summary: 'Get count of customers with push notifications enabled' })
  async getSubscriberCount(
    @Query('partnerId') partnerId?: string,
  ): Promise<{ count: number }> {
    const count = partnerId
      ? await this.pushService.getPartnerSubscriberCount(partnerId)
      : await this.pushService.getAllSubscriberCount();
    return { count };
  }

  @Post('send')
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send promotion notification to partner customers (owner/admin only)' })
  async sendPromotion(
    @Body() dto: SendPromotionDto,
  ): Promise<{ sent: number; failed: number; subscribers: number }> {
    const payload = {
      title: dto.title,
      body: dto.body,
      url: dto.url ?? '/',
      type: 'PROMOTION',
      tag: `promo-${Date.now()}`,
      partnerId: dto.partnerId,
    };

    if (dto.partnerId) {
      return this.pushService.broadcastToPartnerCustomers(dto.partnerId, payload);
    }
    return this.pushService.broadcastToAll(payload);
  }
}
