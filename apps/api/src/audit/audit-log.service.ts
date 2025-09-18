import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AuditLogData {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log audit trail for actions
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          userId: data.userId,
          oldValues: data.oldValues
            ? JSON.stringify(data.oldValues)
            : undefined,
          newValues: data.newValues
            ? JSON.stringify(data.newValues)
            : undefined,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          createdAt: new Date(),
        },
      });

      this.logger.debug(
        `Audit log created: ${data.action} on ${data.resource}`,
        {
          userId: data.userId,
          resourceId: data.resourceId,
          action: data.action,
        },
      );
    } catch (error) {
      // Don't throw error for audit logging failures to prevent breaking main operations
      this.logger.error('Failed to create audit log:', {
        error: error.message,
        data,
      });
    }
  }

  /**
   * Log order-specific actions with enhanced details
   */
  async logOrderAction(
    action: string,
    orderId: string,
    userId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      action: `ORDER_${action.toUpperCase()}`,
      resource: 'orders',
      resourceId: orderId,
      userId,
      newValues: details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceLogs(
    resource: string,
    resourceId: string,
    limit: number = 50,
  ): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          resource,
          resourceId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          action: true,
          oldValues: true,
          newValues: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to fetch audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: string, limit: number = 100): Promise<any[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          newValues: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.logger.error('Failed to fetch user audit logs:', error);
      return [];
    }
  }

  /**
   * Clean old audit logs (for maintenance)
   */
  async cleanOldLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Cleaned ${result.count} old audit logs older than ${daysToKeep} days`,
      );
      return result.count;
    } catch (error) {
      this.logger.error('Failed to clean old audit logs:', error);
      return 0;
    }
  }
}
