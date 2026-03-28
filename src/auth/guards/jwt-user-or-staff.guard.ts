import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtUserAuthGuard } from './jwt-user.guard';
import { JwtStaffAuthGuard } from './jwt-staff.guard';

@Injectable()
export class JwtUserOrStaffAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userGuard = new JwtUserAuthGuard();
    const staffGuard = new JwtStaffAuthGuard();

    try {
      return (await userGuard.canActivate(context)) as boolean;
    } catch {
      return (await staffGuard.canActivate(context)) as boolean;
    }
  }
}
