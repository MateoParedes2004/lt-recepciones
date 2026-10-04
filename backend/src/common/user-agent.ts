// Lectura mínima del "user-agent" (la firma que manda cada navegador) para
// las estadísticas: descartar robots y saber si la visita es de celular o
// computadora. No se guarda el user-agent en ningún lado.

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|bingpreview|google-inspectiontool|curl|wget|python|axios|node-fetch|postman|insomnia/i;

export function isBotUserAgent(userAgent?: string): boolean {
  // Sin user-agent no es un navegador de verdad.
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}

export type DeviceType = 'celular' | 'tablet' | 'computadora';

export function deviceFromUserAgent(userAgent?: string): DeviceType {
  const ua = userAgent ?? '';
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua))
    return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(ua))
    return 'celular';
  return 'computadora';
}
