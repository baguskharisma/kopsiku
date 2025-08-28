import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    refreshToken: string;

    @IsString()
    @IsOptional()
    deviceId?: string;
}