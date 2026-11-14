import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_]{2,19}$/, {
    message: 'username must be 3-20 chars: letters, digits, underscore; starting with a letter',
  })
  username: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(10, { message: 'password must be at least 10 characters' })
  @MaxLength(128)
  @Matches(/[A-Za-z؀-ۿ]/, { message: 'password must contain a letter' })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password: string;

  @Transform(trim)
  @IsString()
  @Length(2, 50)
  displayName: string;
}

export class LoginDto {
  /** Email or username. */
  @Transform(trim)
  @IsString()
  @Length(3, 254)
  identifier: string;

  @IsString()
  @MaxLength(128)
  password: string;
}

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class TokenDto {
  @IsString()
  @Length(20, 200)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @MinLength(10, { message: 'password must be at least 10 characters' })
  @MaxLength(128)
  @Matches(/[A-Za-z\u0600-\u06FF]/, { message: 'password must contain a letter' })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password: string;
}
