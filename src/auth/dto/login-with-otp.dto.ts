import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IndianPhoneTransform, IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class LoginWithOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @Transform(IndianPhoneTransform)
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phone: string;

  @ApiProperty({ example: '1111', required: false, description: 'OTP code. Not required for verified customers.' })
  @IsString()
  @IsOptional()
  otp?: string;
}
