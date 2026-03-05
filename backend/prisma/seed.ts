import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// 1. Cargamos el archivo .env
dotenv.config();

// 2. Creamos una conexión nativa de Postgres usando la URL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 3. Envolvemos esa conexión en el Adaptador de Prisma
const adapter = new PrismaPg(pool);

// 4. ¡Le pasamos el adaptador al constructor! (Esto es lo que Prisma 7 pedía)
const prisma = new PrismaClient({ adapter });

async function main() {
    const categories = [
    {
        name: 'Vajilla y Cristalería',
        products: ['Vaso', 'Plato', 'Platito', 'Copa Barroca Ámbar', 'Copa Barroca Verde', 'Copa Champán', 'Copa Gran Vino', 'Copa para Vino', 'Agua'],
    },
    {
        name: 'Mesas y Mantelería',
        products: ['Mesa Cuadrada', 'Mesa Redonda', 'Mesa Infantil', 'Tablón', 'Mantel', 'Mantelón', 'Caminero'],
    },
    {
        name: 'Cubiertos y complementos',
        products: ['Cuchillo', 'Tenedor', 'Servilletas', 'Posa Plato Rattan', 'Posa Plato Dorado'],
    },
    {
        name: 'Bebidas y Barra',
        products: ['Champañera', 'Tacho para Bebidas'],
    },
    {
        name: 'Sillas',
        products: ['Silla Plástica sin Posa Brazos', 'Silla plástica con Posa Brazos', 'Sillas de Madera', 'Sillas Tifanny Blancas', 'Sillas Tiffany Doradas'],
    },
    {
        name: 'Parrillas',
        products: ['Parrilla para Asado', 'Parrillita'],
    },
    {
        name: 'Climatización',
        products: ['Ventilador de Pie'],
    },
];

    console.log('🌱 Iniciando la siembra de datos de LT Recepciones...');

    for (const cat of categories) {
        const category = await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: { name: cat.name },
    });

    for (const prodName of cat.products) {
        await prisma.product.create({
        data: {
            name: prodName,
            description: `Producto de alta calidad para eventos.`,
            totalStock: 100,
            pricePerDay: 0.0,
            categoryId: category.id,
            },
        });
    }
}

    console.log('✅ ¡Catálogo cargado con éxito!');
}

main()
    .catch((e) => {
        console.error('❌ Error detallado:', e);
        process.exit(1);
    })
    .finally(async () => {
     // Cerramos todo limpiamente
        await prisma.$disconnect();
        await pool.end();
    });