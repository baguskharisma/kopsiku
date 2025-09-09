import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RequestWithUser } from "src/auth/interfaces/request-with-user.interface";

export const GetUserId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest<RequestWithUser>();
      return request.user?.sub;
    },
  );