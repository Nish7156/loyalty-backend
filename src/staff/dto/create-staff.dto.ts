import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;
}
