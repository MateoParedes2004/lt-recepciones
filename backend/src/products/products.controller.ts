import { Controller, Get, Post, Body, Param, Put, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ProductsService } from './products.service';
import { FileInterceptor } from '@nestjs/platform-express';
// 👇 1. Importamos el nuevo servicio de Cloudinary
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    // 👇 2. Inyectamos Cloudinary en el constructor
    private readonly cloudinaryService: CloudinaryService 
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image')) // Ya no usamos configuración de disco local
  async createProduct(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
    let imageUrl = null;

    // 👇 3. Si hay un archivo, lo subimos a la nube
    if (file) {
      const cloudRes = await this.cloudinaryService.uploadImage(file);
      imageUrl = cloudRes.secure_url; // Extraemos el link seguro (https)
    }

    const productData = {
      name: body.name,
      description: body.description,
      pricePerDay: parseFloat(body.pricePerDay),
      categoryId: parseInt(body.categoryId),
      totalStock: parseInt(body.totalStock) || 0, 
      rentedCount: 0, 
      imageUrl: imageUrl, // Guardamos el link de internet en la Base de Datos
    };
    
    return this.productsService.createProduct(productData);
  }

  @Get()
  getAllProducts() {
    return this.productsService.getAllProducts();
  }

  @Get(':id')
  getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(Number(id));
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image'))
  async updateProduct(@Param('id') id: string, @Body() body: any, @UploadedFile() file: Express.Multer.File) {
    const productData: any = {
      name: body.name,
      description: body.description,
      pricePerDay: parseFloat(body.pricePerDay),
      categoryId: parseInt(body.categoryId),
      totalStock: parseInt(body.totalStock) || 0, 
    };
    
    // 👇 4. Si el usuario sube una FOTO NUEVA al editar, la subimos a la nube y reemplazamos el link
    if (file) {
      const cloudRes = await this.cloudinaryService.uploadImage(file);
      productData.imageUrl = cloudRes.secure_url;
    }

    return this.productsService.updateProduct(Number(id), productData);
  }

  @Delete(':id')
  deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(Number(id));
  }
}