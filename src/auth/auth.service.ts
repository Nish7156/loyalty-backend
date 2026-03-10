import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Fast2smsService } from '../fast2sms/fast2sms.service';
import { getOtp, getAndClearOtp, setOtp } from './otp.store';

export interface JwtStaffPayload {
  sub: string;
  phone: string;
  branchId: string;
  type: 'staff';
}

export interface JwtUserPayload {
  sub: string;
  phone: string;
  role: string;
  type: 'user';
}

export interface JwtCustomerPayload {
  phone: string;
  type: 'customer';
}

const DEV_OTP = '1111';

function generateOtp(): string {
  if (process.env.NODE_ENV !== 'production') {
    return DEV_OTP;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Random 4-digit MPIN for end-user (customer) verification only. */
function generateCustomerMpin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly fast2sms: Fast2smsService,
  ) {}

  async sendOtp(phone: string, mpin?: string): Promise<{ success: true; otp?: string }> {
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (user) {
      const code = generateOtp();
      setOtp(phone, code, 'platform');
      const res: { success: true; otp?: string } = { success: true };
      if (process.env.NODE_ENV !== 'production') res.otp = code;
      return res;
    }

    const staff = await this.prisma.staff.findFirst({ where: { phone } });
    if (staff) {
      const code = generateOtp();
      setOtp(phone, code, 'staff');
      const res: { success: true; otp?: string } = { success: true };
      if (process.env.NODE_ENV !== 'production') res.otp = code;
      return res;
    }

    const code = generateCustomerMpin();
    setOtp(phone, code, 'customer');
    const digitsOnly = phone.replace(/\D/g, '');
    const numberForSms = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
    if (numberForSms.length >= 10) {
      try {
        await this.fast2sms.sendOtpViaQuickSms(numberForSms, code);
      } catch {
        // OTP is already stored; still return success so frontend shows OTP step (user can resend)
      }
    }
    const res: { success: true; otp?: string } = { success: true };
    if (process.env.NODE_ENV !== 'production') res.otp = code;
    return res;
  }

  async loginWithOtp(phone: string, otp: string) {
    // Hardcoded dev OTP: 1111 always accepted for any registered phone
    if (otp === DEV_OTP) {
      const user = await this.prisma.user.findFirst({ where: { phone } });
      if (user) return this.loginUserByPhone(phone);
      const staff = await this.prisma.staff.findFirst({ where: { phone } });
      if (staff) return this.loginStaffByPhone(phone);
      throw new UnauthorizedException('Invalid phone or OTP');
    }

    const record = getOtp(phone);
    if (!record || record.code !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    if (new Date() > record.expiresAt) {
      getAndClearOtp(phone);
      throw new UnauthorizedException('OTP expired');
    }
    getAndClearOtp(phone);
    if (record.type === 'platform') {
      return this.loginUserByPhone(phone);
    }
    if (record.type === 'customer') {
      return this.loginCustomerByPhone(phone);
    }
    return this.loginStaffByPhone(phone);
  }

  async loginCustomer(phone: string, otp: string) {
    const record = getOtp(phone);
    if (!record || record.code !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    if (new Date() > record.expiresAt) {
      getAndClearOtp(phone);
      throw new UnauthorizedException('OTP expired');
    }
    getAndClearOtp(phone);
    if (record.type !== 'customer') {
      throw new UnauthorizedException('Invalid OTP for customer');
    }
    return this.loginCustomerByPhone(phone);
  }

  async issueCustomerToken(phone: string): Promise<{ access_token: string; customer: { phone: string } }> {
    return this.loginCustomerByPhone(phone);
  }

  private async loginCustomerByPhone(phone: string) {
    await this.prisma.customer.upsert({
      where: { phoneNumber: phone },
      create: { phoneNumber: phone },
      update: {},
    });
    const payload: JwtCustomerPayload = { phone, type: 'customer' };
    const token = this.jwtService.sign(payload, { expiresIn: '3650d' });
    return { access_token: token, customer: { phone } };
  }

  private async loginUserByPhone(phone: string) {
    const user = await this.prisma.user.findFirst({
      where: { phone },
      include: { ownedPartners: true },
    });
    if (!user) throw new UnauthorizedException('Invalid phone or OTP');
    const payload: JwtUserPayload = {
      sub: user.id,
      phone: user.phone!,
      role: user.role,
      type: 'user',
    };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '90d' }),
      user: { id: user.id, phone: user.phone, role: user.role },
    };
  }

  private async loginStaffByPhone(phone: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { phone },
      include: { branch: true },
    });
    if (!staff) throw new UnauthorizedException('Invalid phone or OTP');
    const payload: JwtStaffPayload = {
      sub: staff.id,
      phone: staff.phone,
      branchId: staff.branchId,
      type: 'staff',
    };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '90d' }),
      staff: { id: staff.id, name: staff.name, phone: staff.phone, branchId: staff.branchId },
    };
  }

  async validateStaff(phone: string, password: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { phone },
      include: { branch: true },
    });
    if (!staff || !staff.password || !(await bcrypt.compare(password, staff.password))) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    return staff;
  }

  async loginStaff(phone: string, password: string) {
    const staff = await this.validateStaff(phone, password);
    return this.loginStaffByPhone(staff.phone);
  }

  async validateUser(phone: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { phone },
      include: { ownedPartners: true },
    });
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    return user;
  }

  async loginUser(phone: string, password: string) {
    const user = await this.validateUser(phone, password);
    return this.loginUserByPhone(user.phone!);
  }
}
