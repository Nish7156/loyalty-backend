import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const DUMMY_OTP = '1111';

export class RegisterCustomerDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Your name (2–200 characters)' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(200, { message: 'Name must be at most 200 characters' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: DUMMY_OTP, description: '4-digit verification code' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export function isOtpValid(otp: string): boolean {
  return otp === DUMMY_OTP;
}
