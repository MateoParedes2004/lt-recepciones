import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Lista explícita en vez de aceptar cualquier "image/*": excluye a propósito
// SVG (puede traer <script> embebido — riesgo de XSS si algún día se sirve
// directo en el navegador) y cualquier otro formato que no necesitamos.
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Config compartida para los endpoints que reciben imágenes (products, gallery):
// máximo 5MB por archivo y solo estos mimetypes, para evitar subir
// archivos arbitrarios o de tamaño excesivo directo a memoria/Cloudinary.
// Esto solo mira el Content-Type que declara el cliente (spoofable) — la
// verificación real del contenido del archivo pasa por isRealImage(),
// aplicada después en CloudinaryService/GalleryService una vez que multer
// ya tiene el buffer completo.
export const multerImageOptions: MulterOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      callback(new BadRequestException('Solo se permiten imágenes JPEG, PNG o WEBP'), false);
      return;
    }
    callback(null, true);
  },
};
