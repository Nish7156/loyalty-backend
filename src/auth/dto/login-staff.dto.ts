import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IndianPhoneTransform, IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class LoginStaffDto {
  @ApiProperty({ example: '+919876543210' })
  @Transform(IndianPhoneTransform)
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phone: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
