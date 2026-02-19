import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'F&B' })
  @IsString()
  @IsNotEmpty()
  industryType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId: string;
}
