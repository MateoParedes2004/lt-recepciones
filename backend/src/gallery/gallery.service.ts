import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v2 as cloudinary } from 'cloudinary';
import { isRealImage } from '../common/verify-image';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class GalleryService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async findAll(isAdmin = false) {
    if (isAdmin) {
      return this.prisma.galleryImage.findMany({ orderBy: { createdAt: 'desc' } });
    }
    return this.prisma.galleryImage.findMany({
      where: { isVisible: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 👈 Ahora recibe un arreglo de archivos
  async create(files: Array<Express.Multer.File>, title?: string) {
    if (!files || files.length === 0) throw new BadRequestException('Debes subir al menos una imagen');
    
    // El filtro de multer solo mira el Content-Type declarado (spoofable); acá
    // ya tenemos el buffer completo, así que confirmamos el contenido real de
    // TODAS las fotos antes de subir ninguna: un archivo inválido al final de
    // la lista no debe dejar las anteriores subidas a medias.
    for (const file of files) {
      if (!isRealImage(file.buffer)) {
        throw new BadRequestException(`"${file.originalname}" no es una imagen válida.`);
      }
    }

    const uploadedImages: any[] = [];

    try {
      // Subimos cada imagen a Cloudinary y la guardamos en la base de datos
      for (const file of files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'lt_recepciones/gallery' },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            },
          );
          uploadStream.end(file.buffer);
        });

        const imageUrl = (uploadResult as any).secure_url;

        const savedImage = await this.prisma.galleryImage.create({
          data: {
            imageUrl,
            title: title || 'Evento LT Recepciones',
            isVisible: true,
          },
        });
        uploadedImages.push(savedImage);
      }
    } catch (error) {
      // Todo o nada: si una foto falla a mitad de camino, deshacemos las que
      // ya se habían guardado en esta misma petición. Si no, el admin vería un
      // error pero la galería tendría fotos nuevas "fantasma".
      for (const saved of uploadedImages) {
        await this.prisma.galleryImage.delete({ where: { id: saved.id } }).catch(() => undefined);
        await this.cloudinaryService.deleteByUrl(saved.imageUrl);
      }
      throw error;
    }

    return uploadedImages;
  }

  async toggleVisibility(id: number) {
    const image = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException(`La imagen con ID ${id} no existe.`);

    return this.prisma.galleryImage.update({
      where: { id },
      data: { isVisible: !image.isVisible },
    });
  }

  async remove(id: number) {
    const deleted = await this.prisma.galleryImage.delete({ where: { id } });
    // Recién después de borrar el registro, liberamos el archivo en Cloudinary.
    await this.cloudinaryService.deleteByUrl(deleted.imageUrl);
    return deleted;
  }
}