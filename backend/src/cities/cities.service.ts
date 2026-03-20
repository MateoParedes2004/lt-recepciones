import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta la ruta según tu estructura

@Injectable()
export class CitiesService {
  // Inyectamos el servicio de Prisma para conectarnos a PostgreSQL
    constructor(private prisma: PrismaService) {}

  // 1. OBTENER CIUDADES (Dependiendo de si es Admin o Cliente)
    async getCities() {
    // Ya no filtramos por isActive, enviamos todas ordenadas alfabéticamente
    return this.prisma.city.findMany({
        orderBy: { name: 'asc' },
        });
    }

  // 2. CREAR UNA NUEVA CIUDAD
    async createCity(data: { name: string; price: number }) {
    return this.prisma.city.create({
        data: {
            name: data.name,
            price: data.price,
            // isActive será true por defecto según tu esquema Prisma
            },
        });
    }

    // 3. ACTUALIZAR UNA CIUDAD (Precio, Nombre o Estado)
    async updateCity(id: number, data: { name?: string; price?: number; isActive?: boolean }) {
    // Primero verificamos si existe para evitar errores raros de Prisma
    const city = await this.prisma.city.findUnique({ where: { id } });
    
    if (!city) {
        throw new NotFoundException(`La ciudad con ID ${id} no existe.`);
    }

    return this.prisma.city.update({
            where: { id },
            data,
        });
    }

  // 4. ELIMINAR UNA CIUDAD
    async deleteCity(id: number) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    
    if (!city) {
        throw new NotFoundException(`No se puede eliminar: La ciudad con ID ${id} no existe.`);
    }

    return this.prisma.city.delete({
            where: { id },
        });
    }
}