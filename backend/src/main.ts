import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ¡Esta línea es magia! Permite que tu web Next.js lea los datos
  app.enableCors(); 
  
  await app.listen(3000);
}
bootstrap();
