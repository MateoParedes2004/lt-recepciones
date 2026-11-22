import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { cleanText } from '../../common/trim';
import { ROLES, type Role } from '../../auth/roles';

const lowerEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserDto {
  @Transform(cleanText)
  @IsString()
  @MinLength(2, { message: 'El nombre tiene que tener al menos 2 letras.' })
  @MaxLength(80)
  name: string;

  @Transform(lowerEmail)
  @IsEmail({}, { message: 'Escribí un correo válido.' })
  @MaxLength(120)
  email: string;

  @IsString()
  @MinLength(8, {
    message: 'La contraseña tiene que tener al menos 8 caracteres.',
  })
  @MaxLength(72, { message: 'La contraseña puede tener hasta 72 caracteres.' })
  password: string;

  @IsIn(ROLES, { message: 'El rol tiene que ser ADMIN (dueño) o VENDEDOR.' })
  role: Role;
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MinLength(2, { message: 'El nombre tiene que tener al menos 2 letras.' })
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(ROLES, { message: 'El rol tiene que ser ADMIN (dueño) o VENDEDOR.' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, {
    message: 'La contraseña tiene que tener al menos 8 caracteres.',
  })
  @MaxLength(72, { message: 'La contraseña puede tener hasta 72 caracteres.' })
  password: string;
}
