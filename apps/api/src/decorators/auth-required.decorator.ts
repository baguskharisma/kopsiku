import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";

export const AuthRequired = () => {
    return applyDecorators(
      UseGuards(JwtAuthGuard),
      ApiBearerAuth(),
      ApiUnauthorizedResponse({ 
        description: 'Unauthorized - Invalid or missing token' 
      }),
    );
  };