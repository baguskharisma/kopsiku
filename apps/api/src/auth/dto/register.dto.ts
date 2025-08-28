import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @IsString()
    @IsNotEmpty()
    @Length(10, 15)
    phone: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsNotEmpty()
    @Length(8, 128)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message: 'Password harus mengandung setidaknya satu huruf besar, satu huruf kecil, satu angka dan satu karakter khusus',
    })
    password: string;

    @IsString()
    @IsNotEmpty()
    passwordConfirm: string;
}