import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Script de un solo uso para crear el primer admin en una base nueva
// (el endpoint POST /auth/register requiere estar logueado, así que no
// sirve para el arranque inicial). Uso:
//   npx ts-node prisma/create-admin.ts "Nombre" correo@ejemplo.com "contraseña"
async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('Uso: npx ts-node prisma/create-admin.ts "Nombre" correo@ejemplo.com "contraseña"');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, name },
    create: { name, email, password: hashedPassword },
  });

  console.log(`✅ Admin listo: ${user.email} (id ${user.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
