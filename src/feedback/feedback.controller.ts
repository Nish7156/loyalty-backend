import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtCustomerAuthGuard)
  create(@Req() req: { user: { phone: string } }, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(req.user.phone, dto.message.trim());
  }

  @Get()
  @UseGuards(JwtUserAuthGuard)
  findAll() {
    return this.feedbackService.findAll();
  }
}