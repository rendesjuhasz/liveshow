import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
    @IsEmail()
    @MaxLength(190)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;
}

export class RegisterDto {
    @IsEmail()
    @MaxLength(190)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    referralCode?: string;

    @IsOptional()
    @IsString()
    @MaxLength(5)
    locale?: string;
}

export class VerifyEmailDto {
    @IsString()
    @MinLength(10)
    token!: string;
}

export class ResendVerificationDto {
    @Transform(({ value }) => (value ? String(value) : undefined))
    @IsOptional()
    @IsEmail()
    @MaxLength(190)
    email?: string;
}

export class ForgotPasswordDto {
    @Transform(({ value }) => (value ? String(value) : undefined))
    @IsOptional()
    @IsEmail()
    @MaxLength(190)
    email?: string;
}

export class TotpCodeDto {
    @IsString()
    @MinLength(6)
    @MaxLength(8)
    code!: string;
}

export class TotpDisableDto {
    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;

    @IsString()
    @MinLength(6)
    @MaxLength(8)
    code!: string;
}

export class ResetPasswordDto {
    @IsString()
    @MinLength(10)
    token!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @MaxLength(200)
    passwordConfirm?: string;
}
