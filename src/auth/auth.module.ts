import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStaffStrategy } from './strategies/jwt-staff.strategy';
import { JwtUserStrategy } from './strategies/jwt-user.strategy';
import { JwtCustomerStrategy } from './strategies/jwt-customer.strategy';
import { JwtCustomerAuthGuard } from './guards/jwt-customer.guard';
import { Fast2smsModule } from '../fast2sms/fast2sms.module';
import { JWT_SECRET } from './jwt-secret';

@Module({
  imports: [
    Fast2smsModule,
    PassportModule.register({ defaultStrategy: 'jwt-staff' }),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStaffStrategy, JwtUserStrategy, JwtCustomerStrategy, JwtCustomerAuthGuard],
  exports: [AuthService, JwtCustomerStrategy, JwtCustomerAuthGuard],
})
export class AuthModule {}
