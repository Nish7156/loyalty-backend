import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly activityService: ActivityService,
  ) {}

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

  @Get(':id/activities')
  getBranchActivities(@Param('id') id: string) {
    return this.activityService.findByBranchId(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtUserAuthGuard)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @Req() req: { user: User }) {
    return this.branchesService.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
