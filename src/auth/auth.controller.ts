import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginWithOtpDto } from './dto/login-with-otp.dto';
import { SendOtpDto } from './dto/send-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone, dto.code);
  }

  @Post('login')
  async login(@Body() dto: LoginWithOtpDto) {
    return this.authService.loginWithOtp(dto.phone, dto.otp);
  }

  @Post('customer-login')
  async customerLogin(@Body() dto: LoginWithOtpDto) {
    return this.authService.loginCustomer(dto.phone, dto.otp);
  }
}
