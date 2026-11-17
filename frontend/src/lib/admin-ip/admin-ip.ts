// DESACTIVADO (2026-11-15): nada importa este archivo; el panel no restringe
// IPs. Pasos para reactivarlo: encabezado de backend/src/auth/admin-ip.ts.

import { BlockList, isIP } from "node:net";

/**
 * Equipos (IPs) que pueden abrir /admin e /iniciar-sesion. Misma regla y misma
 * variable que el backend (backend/src/auth/admin-ip.ts):
 *
 *   ADMIN_ALLOWED_IPS=203.0.113.10, 198.51.100.0/24   IPs, rangos, IPv6
 *   ADMIN_ALLOWED_IPS=*                               sin restricción
 *
 * Sin la variable: en Vercel (producción) nadie entra; en local no se
 * restringe. Es solo del servidor (sin NEXT_PUBLIC_): nunca llega al navegador.
 *
 * Esto solo decide QUÉ PÁGINA se muestra. Los datos los protege el backend,
 * que revisa la IP en el login y en cada pedido del panel.
 */
type Policy = { mode: "open" } | { mode: "closed" } | { mode: "list"; list: BlockList };

/** "::ffff:1.2.3.4" → "1.2.3.4"; quita la zona IPv6; null si no es una IP. */
export function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let value = ip.trim();
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];
  return isIP(value) ? value : null;
}

export function parsePolicy(raw: string | undefined, isProduction: boolean): Policy {
  const items = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return { mode: isProduction ? "closed" : "open" };
  if (items.includes("*")) return { mode: "open" };

  const list = new BlockList();
  let valid = 0;
  for (const item of items) {
    const [address, prefixText, ...rest] = item.split("/");
    const ip = normalizeIp(address);
    if (!ip || rest.length > 0) continue;
    const v6 = isIP(ip) === 6;
    const type = v6 ? "ipv6" : "ipv4";
    if (prefixText === undefined) {
      list.addAddress(ip, type);
      valid++;
      continue;
    }
    const prefix = /^\d{1,3}$/.test(prefixText) ? Number(prefixText) : NaN;
    if (!(prefix >= 0 && prefix <= (v6 ? 128 : 32))) continue;
    list.addSubnet(ip, prefix, type);
    valid++;
  }
  // Todas mal escritas → cerrado, nunca "abierto por error".
  return valid ? { mode: "list", list } : { mode: "closed" };
}

export function isAllowed(policy: Policy, ip: string | null): boolean {
  if (policy.mode === "open") return true;
  if (policy.mode === "closed" || !ip) return false;
  return policy.list.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/**
 * IP del visitante. En Vercel, `x-real-ip` y `x-forwarded-for` los escribe la
 * propia plataforma (pisa lo que mande el visitante), así que no se pueden
 * falsificar. Fuera de Vercel solo importa en desarrollo.
 */
export function clientIp(headers: Headers): string | null {
  const real = normalizeIp(headers.get("x-real-ip"));
  if (real) return real;
  return normalizeIp(headers.get("x-forwarded-for")?.split(",")[0]);
}

let cached: Policy | null = null;

export function adminIpAllowed(ip: string | null): boolean {
  cached ??= parsePolicy(process.env.ADMIN_ALLOWED_IPS, Boolean(process.env.VERCEL));
  return isAllowed(cached, ip);
}
