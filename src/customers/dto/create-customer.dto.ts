import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class CreateCustomerDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phoneNumber: string;
}
