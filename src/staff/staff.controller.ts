import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateStaffDto, @Req() req: { user: { id: string; role: string; ownedPartners: { id: string }[] } }) {
    return this.staffService.create(dto, req.user);
  }

  @Get()
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
