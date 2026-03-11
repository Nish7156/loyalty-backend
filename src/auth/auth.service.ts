import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly fast2sms: Fast2smsService,
  ) {}

  async sendOtp(phone: string, mpin?: string): Promise<{ success: true; otp?: string; skipOtp?: boolean }> {
    this.logger.log(`sendOtp called for phone: ${phone}`);

    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (user) {
      this.logger.log(`User found for phone: ${phone}, generating platform OTP`);
      const code = generateOtp();
      setOtp(phone, code, 'platform');
      const res: { success: true; otp?: string } = { success: true };
      if (process.env.NODE_ENV !== 'production') {
        res.otp = code;
        this.logger.debug(`Dev mode - OTP for ${phone}: ${code}`);
      }
      return res;
    }

    const staff = await this.prisma.staff.findFirst({ where: { phone } });
    if (staff) {
      this.logger.log(`Staff found for phone: ${phone}, generating staff OTP`);
      const code = generateOtp();
      setOtp(phone, code, 'staff');
      const res: { success: true; otp?: string } = { success: true };
      if (process.env.NODE_ENV !== 'production') {
        res.otp = code;
        this.logger.debug(`Dev mode - OTP for ${phone}: ${code}`);
      }
      return res;
    }

    // Check if customer exists and is already verified
    const customer = await this.prisma.customer.findFirst({ where: { phoneNumber: phone } });
    if (customer?.isVerified) {
      this.logger.log(`Verified customer found for phone: ${phone}, skipping OTP - direct login allowed`);
      // Return success with skipOtp flag - customer can login directly
      return { success: true, skipOtp: true };
    }

    this.logger.log(`No user/staff found for phone: ${phone}, treating as new/unverified customer`);
    const code = generateCustomerMpin();
    setOtp(phone, code, 'customer');
    this.logger.log(`Generated customer MPIN: ${code} for phone: ${phone}`);

    const digitsOnly = phone.replace(/\D/g, '');
    const numberForSms = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
    this.logger.log(`Normalized phone number for SMS: ${numberForSms} (original: ${phone})`);

    if (numberForSms.length >= 10) {
      try {
        this.logger.log(`Attempting to send OTP via Fast2SMS to: ${numberForSms}`);
        const result = await this.fast2sms.sendOtpViaQuickSms(numberForSms, code);
        this.logger.log(`OTP sent successfully via Fast2SMS, request_id: ${result.request_id}`);
      } catch (error) {
        // OTP is already stored; still return success so frontend shows OTP step (user can resend)
        this.logger.error(`Failed to send OTP via Fast2SMS to ${numberForSms}:`, error instanceof Error ? error.message : String(error));
        this.logger.warn(`OTP ${code} is stored locally for phone ${phone}, user can retry or use it if they received it`);
      }
    } else {
      this.logger.warn(`Phone number ${phone} is too short (${numberForSms.length} digits), skipping SMS`);
    }

    const res: { success: true; otp?: string } = { success: true };
    if (process.env.NODE_ENV !== 'production') {
      res.otp = code;
      this.logger.debug(`Dev mode - OTP for ${phone}: ${code}`);
    }
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

  async loginCustomer(phone: string, otp?: string) {
    this.logger.log(`loginCustomer called for phone: ${phone}, OTP provided: ${!!otp}`);

    // Check if customer is already verified - allow direct login without OTP
    const customer = await this.prisma.customer.findFirst({ where: { phoneNumber: phone } });
    if (customer?.isVerified && (!otp || !otp.trim())) {
      this.logger.log(`Verified customer ${phone} - allowing direct login without OTP verification`);
      return this.loginCustomerByPhone(phone);
    }

    // If OTP is not provided but customer is not verified, reject
    if (!otp || !otp.trim()) {
      this.logger.warn(`Login attempt without OTP for unverified customer ${phone}`);
      throw new UnauthorizedException('OTP is required');
    }

    // Hardcoded dev OTP: 1111 always accepted in non-production
    if (otp === DEV_OTP && process.env.NODE_ENV !== 'production') {
      this.logger.log(`Dev mode - accepting hardcoded OTP for ${phone}`);
      return this.loginCustomerByPhone(phone);
    }

    const record = getOtp(phone);
    if (!record || record.code !== otp) {
      this.logger.warn(`Invalid OTP attempt for ${phone}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    if (new Date() > record.expiresAt) {
      getAndClearOtp(phone);
      this.logger.warn(`Expired OTP attempt for ${phone}`);
      throw new UnauthorizedException('OTP expired');
    }
    getAndClearOtp(phone);
    if (record.type !== 'customer') {
      this.logger.warn(`Wrong OTP type for customer ${phone}`);
      throw new UnauthorizedException('Invalid OTP for customer');
    }
    this.logger.log(`OTP verified successfully for new customer ${phone}`);
    return this.loginCustomerByPhone(phone);
  }

  async issueCustomerToken(phone: string): Promise<{ access_token: string; customer: { phone: string } }> {
    return this.loginCustomerByPhone(phone);
  }

  private async loginCustomerByPhone(phone: string) {
    // Mark customer as verified on first successful login
    const customer = await this.prisma.customer.upsert({
      where: { phoneNumber: phone },
      create: { phoneNumber: phone, isVerified: true },
      update: { isVerified: true },
    });
    this.logger.log(`Customer ${phone} logged in successfully, verified status: ${customer.isVerified}`);
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
