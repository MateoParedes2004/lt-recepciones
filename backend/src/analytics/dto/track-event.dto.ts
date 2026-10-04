import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Eventos que el sitio público puede registrar (ver SiteMetric en schema.prisma).
// "source" y "device" NO están acá: los registra el servidor junto con la
// visita del día, para que no se puedan inflar mandándolos sueltos.
export const PUBLIC_EVENT_TYPES = [
  'pageview',
  'product_view',
  'add_to_cart',
  'search',
  'search_empty',
  'availability_check',
  'whatsapp_click',
] as const;
export type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];

export const TRAFFIC_SOURCES = [
  'google',
  'otros_buscadores',
  'instagram',
  'facebook',
  'whatsapp',
  'tiktok',
  'youtube',
  'otros_sitios',
  'directo',
] as const;

export class TrackEventDto {
  @IsIn(PUBLIC_EVENT_TYPES)
  type: PublicEventType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  key?: string;
}

export class RegisterVisitDto {
  @IsOptional()
  @IsIn(TRAFFIC_SOURCES)
  source?: (typeof TRAFFIC_SOURCES)[number];
}
