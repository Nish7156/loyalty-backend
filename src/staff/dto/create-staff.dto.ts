import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IndianPhoneTransform, IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(IndianPhoneTransform)
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phone: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;
}
