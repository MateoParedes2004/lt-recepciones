import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, UseGuards, ParseIntPipe } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { FilesInterceptor } from '@nestjs/platform-express'; // 👈 Cambiado a FilesInterceptor
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { multerImageOptions } from '../common/multer-image.config';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 20, multerImageOptions)) // 👈 Ahora espera un campo llamado 'images'
  create(@UploadedFiles() files: Array<Express.Multer.File>, @Body('title') title?: string) {
    return this.galleryService.create(files, title);
  }

  // Público: solo devuelve las fotos visibles.
  @Get()
  findAll() {
    return this.galleryService.findAll(false);
  }

  // Admin: devuelve también las fotos ocultas. Antes esto dependía de un
  // query param (?admin=true) sin ningún guard — cualquiera podía pedirlo
  // directo y ver fotos que el admin había ocultado desde el panel.
  @UseGuards(JwtAuthGuard)
  @Get('admin')
  findAllAdmin() {
    return this.galleryService.findAll(true);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  toggleVisibility(@Param('id', ParseIntPipe) id: number) {
    return this.galleryService.toggleVisibility(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.galleryService.remove(id);
  }
}