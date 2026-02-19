import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginUserDto {
  @ApiProperty({ example: '+15550000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'SuperAdmin@123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
