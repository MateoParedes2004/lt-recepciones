import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Config compartida para los endpoints que reciben imágenes (products, gallery):
// máximo 5MB por archivo y solo mimetypes de imagen, para evitar subir
// archivos arbitrarios o de tamaño excesivo directo a memoria/Cloudinary.
export const multerImageOptions: MulterOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new BadRequestException('Solo se permiten archivos de imagen'), false);
      return;
    }
    callback(null, true);
  },
};
