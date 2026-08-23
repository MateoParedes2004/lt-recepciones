import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'Falta la variable de entorno JWT_SECRET. Definila en backend/.env antes de arrancar el servidor.',
  );
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET, // Llave para firmar sesiones
      signOptions: { expiresIn: '1d' }, // La sesión dura 1 día
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}