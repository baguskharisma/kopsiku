import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { LocalStrategy } from "src/strategies/local.strategy";
import { JwtStrategy } from "src/strategies/jwt.strategy";
import { AuthController } from "./auth.controller";
import { UsersModule } from "src/users/users.module";
import { OtpModule } from "src/otp/otp.module";
import { SharedJwtModule } from "src/strategies/shared-jwt.module";

@Module({
    imports: [
        UsersModule,
        OtpModule,
        PassportModule,
        SharedJwtModule,
    ],
    providers: [AuthService, LocalStrategy, JwtStrategy],
    controllers: [AuthController],
    exports: [AuthService],
})

export class AuthModule {}