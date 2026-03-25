import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Staff } from '@prisma/client';
import { ActivityGateway } from '../websocket/activity.gateway';
import { JwtStaffAuthGuard } from '../auth/guards/jwt-staff.guard';
import { JwtUserAuthGuard } from '../auth/guards/jwt-user.guard';
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
  @UseGuards(JwtUserAuthGuard)
  findAll() {
    return this.activityService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtStaffAuthGuard)
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
    const result = await this.activityService.approveOrReject(id, dto.status, req.user.id, dto.value, req.user.branchId);
    const walletPoints = 'walletPoints' in result ? (result as any).walletPoints : null;
    const socketPayload = {
      id: result.id,
      status: result.status,
      pointsEarned: walletPoints?.pointsEarned ?? null,
    };
    if (result.branchId) {
      this.activityGateway.emitCheckinUpdated(result.branchId, socketPayload);
    }
    if (result.customerId) {
      this.activityGateway.emitCheckinUpdatedToCustomer(result.customerId, socketPayload);
    }
    return result;
  }
}
