import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { IndianPhoneTransform, IsIndianPhone } from '../../common/validators/indian-phone.validator';

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
  @Transform(IndianPhoneTransform)
  @IsString()
  @IsNotEmpty()
  @IsIndianPhone()
  ownerPhone: string;
}
