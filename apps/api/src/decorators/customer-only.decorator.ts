import { Role } from "@prisma/client";
import { Auth } from "./auth.decorator";

export const CustomerOnly = () => Auth(Role.CUSTOMER);