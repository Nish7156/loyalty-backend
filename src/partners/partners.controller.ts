import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@ApiTags('partners')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreatePartnerDto, @Req() req: { user: User }) {
    return this.partnersService.create(dto, req.user.id);
  }

  @Get()
  findAll() {
    return this.partnersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partnersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.partnersService.remove(id);
  }
}
