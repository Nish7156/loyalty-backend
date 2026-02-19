import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { RegisterCustomerDto } from './dto/register.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('register')
  register(@Body() dto: RegisterCustomerDto) {
    return this.customersService.registerAtBranch(dto.branchId, dto.phoneNumber, dto.otp);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get('phone/:phoneNumber')
  findByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.findByPhone(phoneNumber);
  }

  @Get(':phoneNumber')
  findOne(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.findOne(phoneNumber);
  }
}
