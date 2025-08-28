import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.prismaService.isHealthy();
      
      if (isHealthy) {
        const dbInfo = await this.prismaService.getDatabaseInfo();
        return this.getStatus(key, true, { 
          message: 'Database connection is healthy',
          ...dbInfo[0] 
        });
      } else {
        throw new HealthCheckError('Prisma check failed', 
          this.getStatus(key, false, { message: 'Database connection failed' })
        );
      }
    } catch (error) {
      throw new HealthCheckError('Prisma check failed', 
        this.getStatus(key, false, { 
          message: 'Database connection failed',
          error: error.message 
        })
      );
    }
  }
}