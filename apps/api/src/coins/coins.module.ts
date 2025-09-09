import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CoinController } from './coins.controller';
import { CoinService } from './coins.service';
import { AuditLogService } from 'src/audit/audit-log.service';

@Module({
  controllers: [CoinController],
  providers: [CoinService, PrismaService, AuditLogService],
  exports: [CoinService], // Export service for use in other modules
})
export class CoinsModule {}