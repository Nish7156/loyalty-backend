import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendPromotionDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Notification body message' })
  @IsString()
  @MaxLength(300)
  body: string;

  @ApiPropertyOptional({ description: 'Partner ID to send to all their customers (omit for all customers)' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'URL path to open when notification is clicked' })
  @IsOptional()
  @IsString()
  url?: string;
}
