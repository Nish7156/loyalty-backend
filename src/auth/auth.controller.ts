import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginStaffDto } from './dto/login-staff.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('staff/login')
  async staffLogin(@Body() dto: LoginStaffDto) {
    return this.authService.loginStaff(dto.phone, dto.password);
  }
}
