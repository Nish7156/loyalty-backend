import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { IndianPhoneTransform, IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(IndianPhoneTransform)
  @IsString()
  @IsIndianPhone()
  phone?: string;
}
