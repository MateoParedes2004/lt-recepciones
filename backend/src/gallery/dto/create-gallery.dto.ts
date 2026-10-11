import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { GALLERY_EVENT_TYPES } from '../event-types';

// Antes el título se leía directo del body sin pasar por un DTO: a diferencia
// del resto de los endpoints de escritura del backend, no tenía ni chequeo de
// tipo ni límite de tamaño.
export class CreateGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  // Se aplica a todas las fotos del lote subido junto (el panel sube varias
  // fotos de un mismo evento a la vez). Opcional: una foto sin tipo queda
  // "sin clasificar" y se puede etiquetar después desde el panel.
  @IsOptional()
  @IsIn(GALLERY_EVENT_TYPES)
  eventType?: string;
}
