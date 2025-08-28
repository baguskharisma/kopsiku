import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { PrismaModule } from 'src/database/prisma.module';
import { OrdersService } from './orders.sevice';


@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}