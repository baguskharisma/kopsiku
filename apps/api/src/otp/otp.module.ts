import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { OtpService } from './otp.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
