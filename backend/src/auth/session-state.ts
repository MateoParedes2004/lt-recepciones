import type { PrismaService } from '../prisma/prisma.service';

/**
 * Estado vivo de una cuenta (rol, si está activa y su versión de sesión), que
 * el guard consulta en cada pedido. Se guarda unos segundos en memoria para no
 * ir a la base en cada clic (la base gratuita tiene poca memoria y pocas
 * conexiones); al cambiar un usuario se borra de inmediato con `forgetSession`,
 * así un acceso cortado deja de funcionar al instante en este servidor.
 */
export interface SessionState {
  role: string;
  email: string;
  name: string;
  isActive: boolean;
  tokenVersion: number;
}

const TTL_MS = 30_000;
const cache = new Map<number, { state: SessionState | null; at: number }>();

export async function loadSessionState(
  prisma: PrismaService,
  userId: number,
): Promise<SessionState | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      email: true,
      name: true,
      isActive: true,
      tokenVersion: true,
    },
  });
  cache.set(userId, { state: user, at: Date.now() });
  return user;
}

/** Olvida lo guardado de una cuenta: el próximo pedido la vuelve a leer de la base. */
export function forgetSession(userId: number): void {
  cache.delete(userId);
}
