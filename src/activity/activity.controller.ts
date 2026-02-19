import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Staff } from '@prisma/client';
import { ActivityGateway } from '../websocket/activity.gateway';
import { JwtStaffAuthGuard } from '../auth/guards/jwt-staff.guard';
import { ActivityService } from './activity.service';
import { CheckInDto } from './dto/check-in.dto';
import { UpdateActivityStatusDto } from './dto/update-activity-status.dto';

@ApiTags('activity')
@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly activityGateway: ActivityGateway,
  ) {}

  @Post('check-in')
  async checkIn(@Body() dto: CheckInDto) {
    const result = await this.activityService.checkIn(dto);
    this.activityGateway.emitNewCheckInRequest(dto.branchId, result);
    return result;
  }

  @Get()
  findAll() {
    return this.activityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activityService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtStaffAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateActivityStatusDto,
    @Req() req: { user: Staff },
  ) {
    const result = await this.activityService.approveOrReject(id, dto.status, req.user.id, dto.value);
    if (result.branchId) {
      this.activityGateway.emitCheckinUpdated(result.branchId, { id: result.id, status: result.status });
    }
    if (result.customerId) {
      this.activityGateway.emitCheckinUpdatedToCustomer(result.customerId, { id: result.id, status: result.status });
    }
    return result;
  }
}
