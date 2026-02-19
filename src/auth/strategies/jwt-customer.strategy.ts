import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtCustomerPayload } from '../auth.service';

@Injectable()
export class JwtCustomerStrategy extends PassportStrategy(Strategy, 'jwt-customer') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'streak-loyalty-secret-change-in-production',
    });
  }

  validate(payload: JwtCustomerPayload): { phone: string } {
    if (payload.type !== 'customer') throw new UnauthorizedException();
    return { phone: payload.phone };
  }
}
