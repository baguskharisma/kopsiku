import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;           // User ID dari database (untuk konsistensi dengan service layer)
  sub: string;          // Subject dari JWT (biasanya sama dengan id)
  phone: string;        // Phone number
  role: Role;           // User role
  name?: string;        // User name (optional, jika diperlukan)
  email?: string;       // User email (optional)
  iat?: number;         // Issued at (timestamp)
  exp?: number;         // Expires at (timestamp)
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// Alternative interface yang kompatibel dengan yang sudah ada
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

// Utility type untuk mapping antara dua format
export type RequestUserToAuthenticatedUser = RequestUser & {
  id: string;
  name?: string;
  email?: string;
};

// Helper function untuk convert dari RequestUser ke AuthenticatedUser
export function mapToAuthenticatedUser(requestUser: RequestUser): AuthenticatedUser {
  return {
    id: requestUser.sub,
    sub: requestUser.sub,
    phone: requestUser.phone,
    role: requestUser.role,
    iat: requestUser.iat,
    exp: requestUser.exp,
  };
}