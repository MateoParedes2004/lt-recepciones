// Lista cerrada de tipos de evento para clasificar la galería (ver
// GalleryImage.eventType en schema.prisma). Vive en el backend porque acá se
// valida; el frontend tiene su propia copia en lib/gallery.ts con las mismas
// etiquetas — si se agrega un tipo nuevo, hay que actualizar los dos lados.
export const GALLERY_EVENT_TYPES = [
  'Bodas',
  'Cumpleaños de 15',
  'Cumpleaños',
  'Otros',
] as const;

export type GalleryEventType = (typeof GALLERY_EVENT_TYPES)[number];
