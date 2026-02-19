import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'F&B' })
  @IsString()
  @IsNotEmpty()
  industryType: string;

  @ApiPropertyOptional({ description: 'Defaults to current user when omitted' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
