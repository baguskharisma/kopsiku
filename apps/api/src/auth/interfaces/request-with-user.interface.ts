import { Request } from 'express';
import { Role } from '@prisma/client';

export interface RequestUser {
  sub: string;
  phone: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface RequestWithUser extends Request {
  user: RequestUser;
}