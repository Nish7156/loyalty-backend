import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtStaffAuthGuard extends AuthGuard('jwt-staff') {}
