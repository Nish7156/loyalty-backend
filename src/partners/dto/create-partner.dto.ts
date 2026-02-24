import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsIndianPhone } from '../../common/validators/indian-phone.validator';

export class CreatePartnerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'F&B' })
  @IsString()
  @IsNotEmpty()
  industryType: string;

  @ApiProperty({ example: '+919876543210', description: 'Phone number for the partner owner account (Indian format)' })
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  ownerPhone: string;
}
