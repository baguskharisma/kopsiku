import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "src/auth/auth.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'phone',
            passwordField: 'password',
        });
    }

    async validate(phone: string, password: string): Promise<any> {
        const user = await this.authService.validateUser(phone, password);
        if (!user) {
            throw new UnauthorizedException('Kredensial tidak valid');
        }
        return user;
    }
}