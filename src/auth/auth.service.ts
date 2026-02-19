import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtStaffPayload {
  sub: string;
  phone: string;
  branchId: string;
  type: 'staff';
}

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
  type: 'user';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateStaff(phone: string, password: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { phone },
      include: { branch: true },
    });
    if (!staff || !(await bcrypt.compare(password, staff.password))) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    return staff;
  }

  async loginStaff(phone: string, password: string) {
    const staff = await this.validateStaff(phone, password);
    const payload: JwtStaffPayload = {
      sub: staff.id,
      phone: staff.phone,
      branchId: staff.branchId,
      type: 'staff',
    };
    return {
      access_token: this.jwtService.sign(payload),
      staff: { id: staff.id, name: staff.name, phone: staff.phone, branchId: staff.branchId },
    };
  }
}
