import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { GALLERY_EVENT_TYPES } from '../event-types';

// Para corregir el título o el tipo de evento de una foto ya subida (ej. las
// que se cargaron antes de que existiera eventType, o un título puesto mal).
// No incluye imageUrl/isVisible: la foto en sí no se reemplaza acá (hay que
// borrar y subir de nuevo) y la visibilidad ya tiene su propio endpoint
// (PATCH /gallery/:id/toggle).
export class UpdateGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(GALLERY_EVENT_TYPES)
  eventType?: string;
}
