import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class LoginWithOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phone: string;

  @ApiProperty({ example: '1111' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
