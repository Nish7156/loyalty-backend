import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
