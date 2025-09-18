import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Cleanup expired tokens every day at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredTokens() {
    this.logger.log('Starting cleanup of expired tokens...');

    try {
      const deletedCount = await this.prisma.cleanupExpiredTokens();
      this.logger.log(
        `Cleanup completed: ${deletedCount} expired tokens removed`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens:', error);
    }
  }

  // Cleanup expired OTPs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    this.logger.log('Starting cleanup of expired OTPs...');

    try {
      const deletedCount = await this.prisma.cleanupExpiredOtps();
      this.logger.log(
        `Cleanup completed: ${deletedCount} expired OTPs removed`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup expired OTPs:', error);
    }
  }

  // Manual cleanup methods (can be called by admin endpoints)
  async manualTokenCleanup(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.prisma.cleanupExpiredTokens();
    this.logger.log(`Manual token cleanup: ${deletedCount} tokens removed`);
    return { deletedCount };
  }

  async manualOtpCleanup(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.prisma.cleanupExpiredOtps();
    this.logger.log(`Manual OTP cleanup: ${deletedCount} OTPs removed`);
    return { deletedCount };
  }
}
