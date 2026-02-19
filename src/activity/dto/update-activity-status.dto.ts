import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateActivityStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiProperty({ required: false, description: 'Transaction amount (seller enters when approving)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value?: number;
}
