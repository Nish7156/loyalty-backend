import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushController } from './push.controller';
import { PushScheduler } from './push.scheduler';
import { PushService } from './push.service';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService, PushScheduler],
  exports: [PushService],
})
export class PushModule {}
