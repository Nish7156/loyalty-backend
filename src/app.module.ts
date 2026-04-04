import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PartnersModule } from './partners/partners.module';
import { BranchesModule } from './branches/branches.module';
import { StaffModule } from './staff/staff.module';
import { CustomersModule } from './customers/customers.module';
import { ActivityModule } from './activity/activity.module';
import { RewardsModule } from './rewards/rewards.module';
import { WebsocketModule } from './websocket/websocket.module';
import { FeedbackModule } from './feedback/feedback.module';
import { Fast2smsModule } from './fast2sms/fast2sms.module';
import { WalletModule } from './wallet/wallet.module';
import { PushModule } from './push/push.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PartnersModule,
    BranchesModule,
    StaffModule,
    CustomersModule,
    ActivityModule,
    RewardsModule,
    WebsocketModule,
    FeedbackModule,
    Fast2smsModule,
    WalletModule,
    PushModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
