import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

const DUMMY_OTP = '1111';

export class RegisterCustomerDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: DUMMY_OTP, description: 'OTP (dummy: 1111)' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export function isOtpValid(otp: string): boolean {
  return otp === DUMMY_OTP;
}
