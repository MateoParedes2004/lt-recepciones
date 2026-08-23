import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { RentalsModule } from './rentals/rentals.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GalleryModule } from './gallery/gallery.module';
import { CitiesModule } from './cities/cities.module';

@Module({
  imports: [
    // Límite general: 100 requests por minuto por IP. Los endpoints sensibles
    // (login, register) tienen un límite más estricto vía @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    RentalsModule,
    AnalyticsModule,
    GalleryModule,
    CitiesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}