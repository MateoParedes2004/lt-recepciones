import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
    ) {}

    async register(data: any) {
    // 1. Verificamos si el correo ya existe
    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new BadRequestException('El correo ya está registrado');

    // 2. Encriptamos la contraseña (nivel de seguridad bancario)
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Guardamos al administrador en la base de datos
    const user = await this.prisma.user.create({
        data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        },
    });

    return { message: 'Administrador creado con éxito', userId: user.id };
    }

    async login(data: any) {
    // 1. Buscamos al usuario por su correo
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new UnauthorizedException('Correo o contraseña incorrectos');

    // 2. Comparamos la contraseña encriptada
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Correo o contraseña incorrectos');

    // 3. Generamos el Token JWT (El pase VIP)
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { 
        message: 'Acceso concedido', 
        token, 
        user: { name: user.name, email: user.email, role: user.role } 
        };
    }
}