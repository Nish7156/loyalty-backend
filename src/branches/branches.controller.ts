import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateBranchDto, @Req() req: { user: User }) {
    return this.branchesService.create(dto, req.user);
  }

  @Get()
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  findAll(@Req() req: { user: User }) {
    return this.branchesService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
