import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// Cargamos las variables de entorno para que encuentre tu DATABASE_URL
dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    // 1. Creamos la conexión nativa
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 2. Envolvemos la conexión en el adaptador de Prisma 7
    const adapter = new PrismaPg(pool);
    
    // 3. Inicializamos PrismaClient pasándole el adaptador
    super({ adapter });
    
    // Guardamos el pool para poder cerrarlo después
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    // Apagado limpio: cerramos Prisma y la conexión a Postgres
    await this.$disconnect();
    await this.pool.end();
  }
}