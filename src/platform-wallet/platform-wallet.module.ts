import { Module } from '@nestjs/common';
import { PlatformWalletService } from './platform-wallet.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PlatformWalletService],
  exports: [PlatformWalletService],
})
export class PlatformWalletModule {}
