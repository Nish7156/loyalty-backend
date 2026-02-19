import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { CustomersModule } from '../customers/customers.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [CustomersModule, WebsocketModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
