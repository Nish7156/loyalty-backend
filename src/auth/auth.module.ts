import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStaffStrategy } from './strategies/jwt-staff.strategy';
import { JwtUserStrategy } from './strategies/jwt-user.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-staff' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'streak-loyalty-secret-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStaffStrategy, JwtUserStrategy],
  exports: [AuthService],
})
export class AuthModule {}
