import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/trim';

export class LocateDto {
  // Lo que pegó el admin: un link de mapa o unas coordenadas.
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Pegá un link de Google Maps o unas coordenadas.' })
  @MaxLength(2000)
  input: string;
}
