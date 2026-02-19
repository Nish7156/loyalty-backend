import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+15550000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
