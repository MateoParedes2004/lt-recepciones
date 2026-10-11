import { slugify } from "./site";
import type { GalleryImage } from "../types";

// Misma lista que backend/src/gallery/event-types.ts — si se agrega un tipo
// nuevo, hay que actualizar los dos lados (el backend valida contra la suya).
export const GALLERY_EVENT_TYPES = [
  "Bodas",
  "Cumpleaños de 15",
  "Cumpleaños",
  "Otros",
] as const;

export type GalleryEventType = (typeof GALLERY_EVENT_TYPES)[number];

/** "Cumpleaños de 15" → "cumpleanos-de-15", para /galeria/[tipo]. */
export function eventTypeSlug(eventType: string): string {
  return slugify(eventType);
}

/** El tipo de evento (con su capitalización real) que corresponde a un slug de la URL, o null si no es ninguno de los válidos. */
export function eventTypeFromSlug(slug: string): GalleryEventType | null {
  return GALLERY_EVENT_TYPES.find((t) => eventTypeSlug(t) === slug) ?? null;
}

/** Página dedicada de un tipo de evento: /galeria/bodas */
export function galleryTypePath(eventType: string): string {
  return `/galeria/${eventTypeSlug(eventType)}`;
}

/** Fotos de un tipo de evento específico, visibles. */
export function filterByEventType(images: GalleryImage[], eventType: GalleryEventType): GalleryImage[] {
  return images.filter((img) => img.eventType === eventType);
}
