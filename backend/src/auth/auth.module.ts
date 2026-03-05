import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true, 
      secret: process.env.JWT_SECRET || 'super-secreto-lt-recepciones', // Llave para firmar sesiones
      signOptions: { expiresIn: '1d' }, // La sesión dura 1 día
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}