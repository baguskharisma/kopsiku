import { Role } from "@prisma/client";
import { Auth } from "./auth.decorator";

export const AdminOrDriver = () => Auth(Role.ADMIN, Role.SUPER_ADMIN, Role.DRIVER);