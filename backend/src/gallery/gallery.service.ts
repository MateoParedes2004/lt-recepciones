import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class GalleryService {
  constructor(private prisma: PrismaService) {}

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
    
    const uploadedImages: any[] = [];

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

    return uploadedImages;
  }

  async toggleVisibility(id: number) {
    const image = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!image) throw new BadRequestException('Imagen no encontrada');

    return this.prisma.galleryImage.update({
      where: { id },
      data: { isVisible: !image.isVisible },
    });
  }

  async remove(id: number) {
    return this.prisma.galleryImage.delete({ where: { id } });
  }
}