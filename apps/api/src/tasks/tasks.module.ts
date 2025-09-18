import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
