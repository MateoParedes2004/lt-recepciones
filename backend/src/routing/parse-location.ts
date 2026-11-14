import { GeoPoint, isValidPoint } from './geo';

/**
 * Lee la ubicación de entrega tal como la pega el admin: unas coordenadas
 * ("-25.312296, -57.601444"), un link de Google Maps (también el que se abre
 * desde una ubicación compartida por WhatsApp), de Waze, Apple Maps u
 * OpenStreetMap, o grados/minutos/segundos (25°18'44.3"S 57°36'05.2"W).
 *
 * Es una función pura, sin red: los links cortos (maps.app.goo.gl/...) no
 * traen las coordenadas adentro y se devuelven como 'short-link' para que
 * RoutingService los abra.
 */
export type LocationInput =
  | { kind: 'point'; point: GeoPoint }
  | { kind: 'short-link'; url: string }
  /** Un link de mapa reconocible pero sin coordenadas (ej. solo el nombre de un lugar). */
  | { kind: 'link-without-coords' }
  | { kind: 'unrecognized' };

/** Links cortos que redirigen a Google Maps: hay que abrirlos para ver a dónde llevan. */
const SHORT_LINK_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'g.page',
]);

export function isShortLinkHost(hostname: string): boolean {
  return SHORT_LINK_HOSTS.has(hostname.toLowerCase());
}

const NUM = String.raw`[-+]?\d{1,3}(?:[.,]\d+)`;
// Dos números con decimales separados por coma, punto y coma o espacios.
// Admite la coma decimal ("-25,31, -57,60"): cada número exige su parte decimal.
const DECIMAL_PAIR = new RegExp(String.raw`(${NUM})\s*(?:[,;]\s*|\s+)(${NUM})`);
// 25°18'44.3"S — grados, minutos, segundos y hemisferio (O = oeste en español).
const DMS = String.raw`(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″]|'')?\s*`;
const DMS_LAT = new RegExp(DMS + '([NS])', 'i');
const DMS_LNG = new RegExp(DMS + '([EWO])', 'i');
// El apóstrofo SÍ puede ir dentro del link: Google Maps no lo codifica en los
// grados/minutos/segundos (".../place/25°18'44.3"S...").
const URL_WITH_SCHEME = /https?:\/\/[^\s<>"]+/i;
// Algunos links se pegan sin "https://" (copiados de una vista previa de WhatsApp).
const URL_WITHOUT_SCHEME =
  /\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.page|(?:www\.|maps\.)?google\.[a-z.]{2,8}\/maps)[^\s<>"]*/i;
// Puntuación del mensaje pegada al final del link ("…/AbC123." o "(…/AbC123)").
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'»]+$/;

export function parseLocationText(raw: string): LocationInput {
  // Signo menos tipográfico (−) y espacios raros que agregan algunos teclados.
  const text = raw
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ') // incluye el espacio "duro" (NBSP) que pegan algunos teclados
    .trim();
  if (!text) return { kind: 'unrecognized' };

  const link =
    text.match(URL_WITH_SCHEME)?.[0] ??
    withScheme(text.match(URL_WITHOUT_SCHEME)?.[0]);
  if (link) {
    const url = toUrl(link.replace(TRAILING_PUNCTUATION, ''));
    if (url) {
      const point = pointFromUrl(url);
      if (point) return { kind: 'point', point };
      if (isShortLinkHost(url.hostname))
        return { kind: 'short-link', url: url.toString() };
      return { kind: 'link-without-coords' };
    }
  }

  const point = pointFromText(text);
  return point ? { kind: 'point', point } : { kind: 'unrecognized' };
}

/** Coordenadas escritas como texto: decimales o grados/minutos/segundos. */
export function pointFromText(text: string): GeoPoint | null {
  const decimal = text.match(DECIMAL_PAIR);
  if (decimal) {
    const point = { lat: toNumber(decimal[1]), lng: toNumber(decimal[2]) };
    if (isValidPoint(point)) return point;
  }
  const lat = text.match(DMS_LAT);
  const lng = text.match(DMS_LNG);
  if (lat && lng) {
    const point = { lat: dmsToDecimal(lat), lng: dmsToDecimal(lng) };
    if (isValidPoint(point)) return point;
  }
  return null;
}

/**
 * Las coordenadas que trae un link de mapa, de la más precisa a la menos:
 *  1. "!3d…!4d…": el pin exacto del lugar en Google Maps (si hay varios, el último).
 *  2. Parámetros con el destino: q, query, ll, destination, daddr…
 *  3. La ruta: /place/<coords>, /search/<coords>, /dir/<origen>/<destino>.
 *  4. "@lat,lng,zoom": el centro de la pantalla (no el pin, por eso va al final).
 */
export function pointFromUrl(url: URL, depth = 0): GeoPoint | null {
  // Página de consentimiento de Google: el link real viene en "continue".
  const next = url.searchParams.get('continue');
  if (next && depth < 2) {
    const inner = toUrl(next);
    if (inner) return pointFromUrl(inner, depth + 1);
  }

  const full = safeDecode(url.href);

  const pins = [...full.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  for (const pin of pins.reverse()) {
    const point = { lat: Number(pin[1]), lng: Number(pin[2]) };
    if (isValidPoint(point)) return point;
  }

  for (const param of [
    'q',
    'query',
    'll',
    'destination',
    'daddr',
    'sll',
    'center',
  ]) {
    const value = url.searchParams.get(param);
    const point = value ? pointFromText(value) : null;
    if (point) return point;
  }
  const mlat = url.searchParams.get('mlat'); // OpenStreetMap
  const mlon = url.searchParams.get('mlon');
  if (mlat && mlon) {
    const point = { lat: Number(mlat), lng: Number(mlon) };
    if (isValidPoint(point)) return point;
  }

  // En /dir/<origen>/<destino> el destino es el último: se recorre de atrás para adelante.
  const segments = safeDecode(url.pathname)
    .split('/')
    .filter(Boolean)
    .reverse();
  for (const segment of segments) {
    if (segment.startsWith('@') || segment.startsWith('data=')) continue;
    const point = pointFromText(segment.replace(/\+/g, ' '));
    if (point) return point;
  }

  const center = full.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (center) {
    const point = { lat: Number(center[1]), lng: Number(center[2]) };
    if (isValidPoint(point)) return point;
  }

  // OpenStreetMap: #map=zoom/lat/lng
  const osm = url.hash.match(/map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (osm) {
    const point = { lat: Number(osm[1]), lng: Number(osm[2]) };
    if (isValidPoint(point)) return point;
  }
  return null;
}

export function toUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function withScheme(value: string | undefined): string | undefined {
  return value ? `https://${value}` : undefined;
}

function toNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

function dmsToDecimal(m: RegExpMatchArray): number {
  const value = Number(m[1]) + Number(m[2]) / 60 + toNumber(m[3]) / 3600;
  return /[SWO]/i.test(m[4]) ? -value : value;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
