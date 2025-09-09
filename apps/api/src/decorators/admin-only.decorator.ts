import { Role } from "@prisma/client";
import { Auth } from "./auth.decorator";

export const AdminOnly = () => Auth(Role.ADMIN, Role.SUPER_ADMIN);