import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtStaffPayload } from '../auth.service';
import { JWT_SECRET } from '../jwt-secret';

@Injectable()
export class JwtStaffStrategy extends PassportStrategy(Strategy, 'jwt-staff') {
  constructor(
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtStaffPayload) {
    if (payload.type !== 'staff') throw new UnauthorizedException();
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      include: { branch: true },
    });
    if (!staff) throw new UnauthorizedException();
    return staff;
  }
}
