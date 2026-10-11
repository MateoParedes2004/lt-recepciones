#!/usr/bin/env node
// "npx prisma db push" corre UNA sola vez durante el build de Render, sin
// ningún reintento propio: si la base de datos está dormida (como pasa en
// los planes gratuitos, tanto de Render como de Neon) y tarda unos segundos
// en despertar, el build entero fallaba con "P1001: Can't reach database
// server" aunque la base estuviera perfectamente sana apenas un rato después.
//
// Esto NO es el mismo problema que ya se resolvió en
// stock-model-migration.service.ts: ese reintento corre DESPUÉS de que el
// build terminó, cuando la aplicación ya arrancó — acá el build todavía ni
// llegó a compilar el código, así que si la base no responde en ese momento
// puntual, no hay ninguna segunda oportunidad.
//
// Esta pequeña envoltura reintenta el comando con espera creciente antes de
// rendirse, en vez de fallar a la primera. Se usa en el "Build Command" de
// Render en reemplazo de llamar a "prisma db push" directo:
//   npm install && npx prisma generate && node scripts/db-push-with-retry.mjs && npm run build
import { spawnSync } from 'node:child_process';

const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let delay = INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = spawnSync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      stdio: 'inherit',
      shell: true,
    });

    if (result.status === 0) {
      process.exit(0);
    }

    const isLastAttempt = attempt === MAX_ATTEMPTS;
    if (isLastAttempt) {
      console.error(
        `\n❌ "prisma db push" falló ${MAX_ATTEMPTS} veces seguidas (último código: ${result.status}). Revisá que la base de datos esté activa y accesible.`,
      );
      process.exit(result.status ?? 1);
    }

    console.warn(
      `\n⚠️  "prisma db push" falló (intento ${attempt}/${MAX_ATTEMPTS}, código ${result.status}). ` +
        `Puede ser que la base todavía esté despertando. Reintentando en ${Math.round(delay / 1000)} s…\n`,
    );
    await sleep(delay);
    delay = Math.min(delay * 2, MAX_DELAY_MS);
  }
}

main();
