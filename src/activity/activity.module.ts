import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { CustomersModule } from '../customers/customers.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { WalletModule } from '../wallet/wallet.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [CustomersModule, WebsocketModule, WalletModule, PushModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
