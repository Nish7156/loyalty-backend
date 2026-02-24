import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phone: string;

  @ApiProperty({ example: '1234', required: false, description: 'Optional 4-digit MPIN (customer flow); if provided, stored instead of generating OTP' })
  @IsOptional()
  @IsString()
  code?: string;
}
