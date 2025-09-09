import { Role } from "@prisma/client";
import { Auth } from "./auth.decorator";

export const DriverOnly = () => Auth(Role.DRIVER);