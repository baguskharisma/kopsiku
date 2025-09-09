import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';


@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'colorless',
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (event) => {
        this.logger.debug(`Query: ${event.query}`);
        this.logger.debug(`Params: ${event.params}`);
        this.logger.debug(`Duration: ${event.duration}ms`);
      });
    }

    // Log errors
    this.$on('error', (event) => {
      this.logger.error('Database error:', event);
    });

    // Log info
    this.$on('info', (event) => {
      this.logger.log(`Database info: ${event.message}`);
    });

    // Log warnings
    this.$on('warn', (event) => {
      this.logger.warn(`Database warning: ${event.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Failed to disconnect from database:', error);
    }
  }

  /**
   * Graceful shutdown helper
   */
  async enableShutdownHooks(app: any) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  /**
   * Utility method for handling database transactions
   */
  async executeTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.$transaction(callback);
  }

  /**
   * Utility method to check database connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Utility method to get database info for health checks
   */
  async getDatabaseInfo(): Promise<Array<{
    database_name: string;
    version: string;
    current_user: string;
    server_address: string | null;
    server_port: number | string | null;
  }>> {
    try {
      const result = await this.$queryRaw<Array<{
        database_name: string;
        version: string;
        current_user: string;
        server_address: string | null;
        server_port: number | string | null;
      }>>`
        SELECT 
          current_database() as database_name,
          version() as version,
          current_user as current_user,
          inet_server_addr() as server_address,
          inet_server_port() as server_port
      `;
      return result;
    } catch (error) {
      this.logger.error('Failed to get database info:', error);
      throw error;
    }
  }

  /**
   * Soft delete utility method
   */
  async softDelete(model: any, where: any) {
    return model.update({
      where,
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Restore soft deleted record utility method
   */
  async restore(model: any, where: any) {
    return model.update({
      where,
      data: {
        deletedAt: null,
      },
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { 
            isRevoked: true,
            revokedAt: { lt: thirtyDaysAgo },
          },
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired/revoked tokens`);
    return result.count;
  }
  
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.otp.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired OTPs`);
    return result.count;
  }
}