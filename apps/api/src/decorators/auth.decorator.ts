import { applyDecorators, UseGuards } from "@nestjs/common";
import { Roles } from "./roles.decorator";
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { Role } from "@prisma/client";
import { RolesGuard } from "src/guards/roles.guard";

export const Auth = (...roles: Role[]) => {
    return applyDecorators(
      UseGuards(JwtAuthGuard, RolesGuard),
      Roles(...roles),
      ApiBearerAuth(),
      ApiUnauthorizedResponse({ 
        description: 'Unauthorized - Invalid or missing token' 
      }),
      ApiForbiddenResponse({ 
        description: 'Forbidden - Insufficient permissions' 
      }),
    );
  };