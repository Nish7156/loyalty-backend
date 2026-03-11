import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';

export class UpdateBranchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional({ enum: ['VISITS', 'POINTS', 'HYBRID'], description: 'Loyalty system type' })
  @IsOptional()
  @IsEnum(['VISITS', 'POINTS', 'HYBRID'])
  loyaltyType?: 'VISITS' | 'POINTS' | 'HYBRID';

  @ApiPropertyOptional({ description: 'Lock settings to prevent store owner from changing (admin only)' })
  @IsOptional()
  @IsBoolean()
  settingsLocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number };
}
