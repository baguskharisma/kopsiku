import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class LoginDto {
    @IsString()
    @IsNotEmpty()
    @Length(10, 15)
    phone: string;

    @IsString()
    @IsNotEmpty()
    @Length(6, 128)
    password: string;

    @IsString()
    @IsOptional()
    deviceId?: string;
}