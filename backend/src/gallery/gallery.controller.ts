import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, Query, UseGuards } from '@nestjs/common';
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

  @Get()
  findAll(@Query('admin') admin?: string) {
    return this.galleryService.findAll(admin === 'true');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  toggleVisibility(@Param('id') id: string) {
    return this.galleryService.toggleVisibility(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.galleryService.remove(+id);
  }
}