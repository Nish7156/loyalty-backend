import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { JwtCustomerAuthGuard } from '../auth/guards/jwt-customer.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { RegisterCustomerDto } from './dto/register.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me/profile')
  @UseGuards(JwtCustomerAuthGuard)
  getMyProfile(@Req() req: { user: { phone: string } }) {
    return this.customersService.getProfileByPhone(req.user.phone);
  }

  @Post('register')
  async register(@Body() dto: RegisterCustomerDto) {
    await this.customersService.registerAtBranch(dto.branchId, dto.phoneNumber, dto.otp);
    return this.authService.issueCustomerToken(dto.phoneNumber);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get('phone/:phoneNumber/profile')
  getProfile(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.getProfileByPhone(phoneNumber);
  }

  @Get('phone/:phoneNumber')
  findByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.findByPhone(phoneNumber);
  }

  @Get(':phoneNumber')
  findOne(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.findOne(phoneNumber);
  }
}
