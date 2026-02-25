import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { IndianPhoneTransform, IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class RequestLocationDto {
  @ApiProperty()
  @IsNumber()
  lat: number;

  @ApiProperty()
  @IsNumber()
  lng: number;
}

export class CheckInDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(IndianPhoneTransform)
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Customer name (string only)' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  value?: number;

  @ApiPropertyOptional({ description: 'Customer request location for geofencing' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RequestLocationDto)
  requestLocation?: { lat: number; lng: number };
}
