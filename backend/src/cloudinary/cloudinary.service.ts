import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import toStream = require('buffer-to-stream');
import { isRealImage } from '../common/verify-image';

// Solo borramos archivos que subió esta app (estas carpetas). Es un seguro:
// si alguna vez una URL apunta a otro lugar, nunca tocamos ese archivo.
const OWN_FOLDERS = ['lt-recepciones/', 'lt_recepciones/gallery/'];

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  async uploadImage(file: Express.Multer.File): Promise<any> {
    // El filtro de multer solo mira el Content-Type declarado (spoofable);
    // acá ya tenemos el buffer completo, así que confirmamos el contenido
    // real antes de mandarlo a Cloudinary.
    if (!isRealImage(file.buffer)) {
      throw new BadRequestException('El archivo no es una imagen válida.');
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'lt-recepciones' }, // Crea una carpeta en tu nube
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      toStream(file.buffer).pipe(upload);
    });
  }

  /** public_id de una URL de Cloudinary de nuestras carpetas, o null si no aplica. */
  publicIdFromUrl(url?: string | null): string | null {
    if (!url || !url.includes('res.cloudinary.com')) return null;
    const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    if (!match) return null;
    const publicId = decodeURIComponent(match[1]);
    return OWN_FOLDERS.some((folder) => publicId.startsWith(folder)) ? publicId : null;
  }

  /**
   * Borra la imagen de Cloudinary cuando deja de usarse (producto borrado,
   * foto reemplazada, foto de galería eliminada). Sin esto los archivos
   * quedaban huérfanos acumulando espacio y costo. Es "mejor esfuerzo": si
   * falla, se registra y se sigue — nunca debe impedir la operación principal.
   */
  async deleteByUrl(url?: string | null): Promise<void> {
    const publicId = this.publicIdFromUrl(url);
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${publicId} de Cloudinary: ${(error as Error).message}`);
    }
  }
}
