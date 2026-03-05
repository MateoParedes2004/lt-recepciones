import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, Query } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { FilesInterceptor } from '@nestjs/platform-express'; // 👈 Cambiado a FilesInterceptor

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images')) // 👈 Ahora espera un campo llamado 'images'
  create(@UploadedFiles() files: Array<Express.Multer.File>, @Body('title') title?: string) {
    return this.galleryService.create(files, title);
  }

  @Get()
  findAll(@Query('admin') admin?: string) {
    return this.galleryService.findAll(admin === 'true');
  }

  @Patch(':id/toggle')
  toggleVisibility(@Param('id') id: string) {
    return this.galleryService.toggleVisibility(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.galleryService.remove(+id);
  }
}