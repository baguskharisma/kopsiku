import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { OrdersService } from './orders.sevice';
import { AuthModule } from 'src/auth/auth.module';
import { CoinsModule } from 'src/coins/coins.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 10, // 10 requests per minute per IP
    }]),
    AuthModule,
    CoinsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersGateway,
    PrismaService,
    AuditLogService,
  ],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}