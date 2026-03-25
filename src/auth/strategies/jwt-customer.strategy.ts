import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtCustomerPayload } from '../auth.service';
import { JWT_SECRET } from '../jwt-secret';

@Injectable()
export class JwtCustomerStrategy extends PassportStrategy(Strategy, 'jwt-customer') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  validate(payload: JwtCustomerPayload): { phone: string } {
    if (payload.type !== 'customer') throw new UnauthorizedException();
    return { phone: payload.phone };
  }
}
