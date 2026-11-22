import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { TokenPayload } from './jwt-auth.guard';
import { forgetSession } from './session-state';

/** Duración de la sesión: 30 días con "Recordarme" (el celular), 1 día sin. */
const sessionLength = (remember: boolean) => (remember ? '30d' : '1d');

// Hash de relleno: si el correo no existe se compara igual contra uno, para que
// tardar menos no delate que ese correo no tiene cuenta.
const DUMMY_HASH = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

const PUBLIC_USER = { id: true, name: true, email: true, role: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private sign(
    user: { id: number; email: string; role: string; tokenVersion: number },
    remember: boolean,
  ) {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
      rem: remember,
    };
    return this.jwtService.sign(payload, {
      expiresIn: sessionLength(remember),
    });
  }

  async login(data: LoginDto) {
    // Sin distinguir mayúsculas: las cuentas viejas pueden tener el correo guardado con mayúsculas.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: data.email, mode: 'insensitive' } },
    });
    // Mismo mensaje si no existe o si la contraseña no coincide: no se revela qué correos tienen cuenta.
    const passwordOk = await bcrypt.compare(
      data.password,
      user?.password ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    if (!user.isActive)
      throw new UnauthorizedException(
        'Esta cuenta está desactivada. Pedile acceso al dueño.',
      );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      message: 'Acceso concedido',
      token: this.sign(user, data.remember === true),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /** Quién es la sesión actual (el panel lo pide al abrir, para saber qué mostrar). */
  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER,
    });
    if (!user) throw new NotFoundException('La cuenta ya no existe.');
    return user;
  }

  /**
   * Cambia la contraseña propia. Corta las sesiones abiertas en otros
   * dispositivos (por si alguien la conocía) y devuelve una sesión nueva para
   * este, así quien la cambió no tiene que volver a ingresar.
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    remember: boolean,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('La cuenta ya no existe.');
    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'La contraseña nueva tiene que ser distinta de la actual.',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(dto.newPassword, 10),
        tokenVersion: { increment: 1 },
      },
    });
    forgetSession(userId);
    return {
      message:
        'Contraseña cambiada. Se cerró la sesión en los demás dispositivos.',
      token: this.sign(updated, remember),
    };
  }
}
