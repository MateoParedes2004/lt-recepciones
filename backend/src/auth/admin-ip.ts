import { BlockList, isIP } from 'node:net';
import { Logger } from '@nestjs/common';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║ DESACTIVADO (decisión del dueño, 2026-11-15). Este código está       ║
 * ║ listo y probado, pero hoy NADIE lo usa: el panel no restringe IPs.   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * PARA REACTIVARLO (todo junto, en un mismo despliegue):
 *  1. Cargar ADMIN_ALLOWED_IPS en Render Y en Vercel ANTES de subir el
 *     código (sin la variable, en producción el panel queda cerrado).
 *  2. Backend:
 *     - jwt-auth.guard.ts, al principio de canActivate (después de leer el
 *       request):  assertAdminIp(request);   (import desde './admin-ip.guard')
 *     - auth.controller.ts, en el login: @UseGuards(AdminIpGuard)
 *     - main.ts, después de `trust proxy`: adminIpPolicy();  (así el log de
 *       arranque muestra la lista)
 *     - En admin-ip.spec.ts, volver a probar que JwtAuthGuard rechaza otra IP.
 *  3. Frontend (código en frontend/src/lib/admin-ip/):
 *     - Copiar proxy.ts a frontend/src/proxy.ts (Next exige que `config` esté
 *       escrito EN ese archivo; no sirve re-exportarlo) y ajustar el import.
 *     - Crear frontend/src/app/acceso-restringido/page.tsx con:
 *         export { default, metadata } from "../../lib/admin-ip/AccesoRestringido";
 *     - En lib/api.ts (apiFetch), ante un 403 con code "ADMIN_IP_NOT_ALLOWED",
 *       llevar a /acceso-restringido.
 *     - robots.ts: sumar '/acceso-restringido' a disallow.
 *  4. Verificar en producción que el 403 muestre la IP real del visitante
 *     (prueba de que `trust proxy` en Render da la IP correcta).
 *
 * Lista de equipos (IPs) que pueden usar el panel: login y todo lo que exige
 * sesión. Se configura con la variable ADMIN_ALLOWED_IPS, separada por comas:
 *
 *   ADMIN_ALLOWED_IPS=203.0.113.10                 una IP
 *   ADMIN_ALLOWED_IPS=203.0.113.10, 198.51.100.0/24  una IP y un rango
 *   ADMIN_ALLOWED_IPS=2803:2a00::/32                 también IPv6
 *   ADMIN_ALLOWED_IPS=*                              sin restricción
 *
 * Sin la variable: en Render (producción) NADIE entra — mejor un panel cerrado
 * por olvido que uno abierto sin que nadie lo note —; en desarrollo no se
 * restringe. Una entrada mal escrita se ignora y se avisa en el log (no tira
 * abajo el sitio público, que no depende de esta lista).
 *
 * El frontend (proxy.ts) aplica la misma regla a las páginas /admin e
 * /iniciar-sesion, pero eso es solo para mostrar el aviso: quien protege los
 * datos es el backend.
 */
export type AdminIpPolicy =
  | { mode: 'open' }
  | { mode: 'closed' }
  | { mode: 'list'; list: BlockList; entries: string[] };

/** Código que viaja en el 403 para que el panel sepa que es un bloqueo por IP. */
export const ADMIN_IP_ERROR_CODE = 'ADMIN_IP_NOT_ALLOWED';

/**
 * Deja la IP en su forma canónica: sin el prefijo IPv4-en-IPv6
 * ("::ffff:1.2.3.4" → "1.2.3.4", así llega a veces a Node) ni zona ("%eth0").
 */
export function normalizeIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  let value = ip.trim();
  const zone = value.indexOf('%');
  if (zone !== -1) value = value.slice(0, zone);
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];
  return isIP(value) ? value : null;
}

export function parseAllowList(
  raw: string | undefined,
  isProduction: boolean,
): { policy: AdminIpPolicy; invalid: string[] } {
  const items = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return { policy: { mode: isProduction ? 'closed' : 'open' }, invalid: [] };
  }
  if (items.includes('*')) return { policy: { mode: 'open' }, invalid: [] };

  const list = new BlockList();
  const entries: string[] = [];
  const invalid: string[] = [];
  for (const item of items) {
    const [address, prefixText, ...rest] = item.split('/');
    const ip = normalizeIp(address);
    const family = ip ? isIP(ip) : 0;
    if (!ip || rest.length > 0) {
      invalid.push(item);
      continue;
    }
    const type = family === 6 ? 'ipv6' : 'ipv4';
    if (prefixText === undefined) {
      list.addAddress(ip, type);
      entries.push(ip);
      continue;
    }
    const prefix = /^\d{1,3}$/.test(prefixText) ? Number(prefixText) : NaN;
    if (!(prefix >= 0 && prefix <= (family === 6 ? 128 : 32))) {
      invalid.push(item);
      continue;
    }
    list.addSubnet(ip, prefix, type);
    entries.push(`${ip}/${prefix}`);
  }

  // Todas las entradas mal escritas: cerrado (nunca "abierto por error").
  if (entries.length === 0) return { policy: { mode: 'closed' }, invalid };
  return { policy: { mode: 'list', list, entries }, invalid };
}

export function isIpAllowed(policy: AdminIpPolicy, ip: string | null): boolean {
  if (policy.mode === 'open') return true;
  if (policy.mode === 'closed' || !ip) return false;
  return policy.list.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

let cached: AdminIpPolicy | null = null;

/** La política de este proceso (se lee una vez: cambiarla requiere redeploy). */
export function adminIpPolicy(): AdminIpPolicy {
  if (cached) return cached;
  const logger = new Logger('AdminIp');
  const { policy, invalid } = parseAllowList(
    process.env.ADMIN_ALLOWED_IPS,
    Boolean(process.env.RENDER),
  );
  if (invalid.length) {
    logger.error(
      `ADMIN_ALLOWED_IPS tiene entradas inválidas que se ignoran: ${invalid.join(', ')}`,
    );
  }
  if (policy.mode === 'closed') {
    logger.error(
      invalid.length
        ? 'ADMIN_ALLOWED_IPS no tiene ninguna IP válida: el panel queda cerrado para todos.'
        : 'Falta ADMIN_ALLOWED_IPS: en producción el panel queda cerrado para todos hasta definirla.',
    );
  } else if (policy.mode === 'list') {
    logger.log(`Panel restringido a: ${policy.entries.join(', ')}`);
  }
  cached = policy;
  return policy;
}

/** Solo para pruebas. */
export function resetAdminIpPolicyCache(): void {
  cached = null;
}
