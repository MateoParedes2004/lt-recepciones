import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { RentalsModule } from './rentals/rentals.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GalleryModule } from './gallery/gallery.module';

@Module({
  imports: [
    // Esto expone la carpeta 'uploads' para que las fotos se puedan ver en la web
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    RentalsModule,
    AnalyticsModule,
    GalleryModule,
  ],
})
export class AppModule {}