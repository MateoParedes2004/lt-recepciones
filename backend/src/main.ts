import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'];

function assertRequiredEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}. Revisá backend/.env (ver .env.example).`,
    );
  }
}

async function bootstrap() {
  assertRequiredEnvVars();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En Render cada pedido llega a través de su balanceador: sin esto, Express
  // ve la IP del balanceador en vez de la del visitante, y los límites por IP
  // (login, visitas, eventos) se volvían límites compartidos por TODO el sitio.
  // "1" = confiar solo en el último proxy (el de Render), así nadie puede
  // falsificar su IP mandando su propio X-Forwarded-For. Render define RENDER
  // automáticamente; en otro hosting se configura con TRUST_PROXY.
  const trustProxy =
    process.env.TRUST_PROXY ?? (process.env.RENDER ? '1' : undefined);
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }

  app.use(helmet());
  app.use(compression());

  // FRONTEND_URL admite varios orígenes separados por coma (ej. en desarrollo
  // "http://localhost:3001,http://127.0.0.1:3001"). Con un solo valor, como
  // en producción, se comporta igual que siempre: una única URL permitida.
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Un campo que el DTO no declara ahora se rechaza con 400 en vez de
      // descartarse en silencio: así un error de formulario se nota al instante.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 3000;

  await app.listen(port);

  console.log(`🚀 API ejecutándose en el puerto ${port}`);
}
bootstrap().catch((error) => {
  console.error('El servidor no pudo arrancar:', (error as Error).message);
  process.exit(1);
});
