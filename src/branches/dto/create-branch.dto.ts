import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  branchName: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  partnerId: string;

  @ApiPropertyOptional({ enum: ['VISITS', 'POINTS', 'HYBRID'], description: 'Loyalty system type' })
  @IsOptional()
  @IsEnum(['VISITS', 'POINTS', 'HYBRID'])
  loyaltyType?: 'VISITS' | 'POINTS' | 'HYBRID';

  @ApiPropertyOptional({ description: 'e.g. { "streakThreshold": 20, "cooldownHours": 18 }' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'e.g. { "lat": 40.7, "lng": -74.0 }' })
  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number };
}
