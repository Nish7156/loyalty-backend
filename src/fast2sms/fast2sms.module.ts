import { Module } from '@nestjs/common';
import { Fast2smsService } from './fast2sms.service';

@Module({
  providers: [Fast2smsService],
  exports: [Fast2smsService],
})
export class Fast2smsModule {}
