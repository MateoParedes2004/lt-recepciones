// Herramienta de mantenimiento (no corre en producción): calcula los km POR
// RUTA desde el depósito hasta cada ciudad de prisma/cities.ts y regenera
// src/cities/city-distances.ts. Volver a correrla solo si el depósito se muda
// (se cambia DEPOT en src/routing/geo.ts) o se agregan ciudades a la lista.
//
// Los km nuevos llegan a la base de datos por CityDistanceMigration, que corre
// una sola vez por versión (MARKER). Para que una tabla nueva se aplique:
//   1) congelar la tabla actual como city-distances-v1.ts (o la siguiente) y
//   2) cambiar el MARKER de la migración.
//
//   node prisma/compute-city-distances.mjs        (desde la carpeta backend)
//
// Ubicación de cada ciudad: Nominatim (OpenStreetMap), máximo 1 consulta por
// segundo según su política de uso. Distancia por ruta: Geoapify, el mismo
// servicio que usa el panel para la ubicación exacta de entrega (así el precio
// por ciudad y el precio por dirección salen del mismo motor). Su plan gratis
// permite uso comercial; hace falta GEOAPIFY_API_KEY en backend/.env. Se usan
// unas 250 consultas de las 3.000 diarias. Tarda unos 6 minutos.
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY?.trim();
if (!GEOAPIFY_API_KEY) {
  console.error('Falta GEOAPIFY_API_KEY: agregala en backend/.env (clave gratis de https://myprojects.geoapify.com).');
  process.exit(1);
}

const USER_AGENT = 'lt-recepciones-city-distances/1.0';

const DEPARTAMENTOS = {
  CAPITAL: 'Asunción',
  CENTRAL: 'Central',
  'CONCEPCIÓN': 'Concepción',
  'SAN PEDRO': 'San Pedro',
  CORDILLERA: 'Cordillera',
  'GUAIRÁ': 'Guairá',
  'CAAGUAZÚ': 'Caaguazú',
  'CAAZAPÁ': 'Caazapá',
  'ITAPÚA': 'Itapúa',
  MISIONES: 'Misiones',
  'PARAGUARÍ': 'Paraguarí',
  'ALTO PARANÁ': 'Alto Paraná',
  'ÑEEMBUCÚ': 'Ñeembucú',
  AMAMBAY: 'Amambay',
  'CANINDEYÚ': 'Canindeyú',
  'PRESIDENTE HAYES': 'Presidente Hayes',
  'BOQUERÓN': 'Boquerón',
  'ALTO PARAGUAY': 'Alto Paraguay',
};

// Ubicaciones que OpenStreetMap confunde con un lugar homónimo y que se
// verificaron a mano: quedan sin km (se cargan en el panel). "Nueva Asunción"
// es un distrito del Chaco, pero devuelve un lugar a 19 km de la capital.
const KNOWN_WRONG = new Set(['Nueva Asunción']);

// Ciudades donde el punto que elige Nominatim no representa bien "el centro":
// se usa uno fijo, elegido a mano. Asunción: el punto automático (-25.2800,
// -57.6344) da una ruta de 8,5 km desde el depósito, mucho más que casi todos
// los barrios (2,6 a 6,3 km); la Plaza de los Héroes, el centro de verdad, da 6,3.
const ANCHORS = {
  'Asunción': { lat: -25.2866, lon: -57.6333, sameDept: true, found: 'Plaza de los Héroes (punto fijo)' },
};

const here = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch que reintenta los cortes de red (internet que se cae unos segundos,
 * DNS que no responde): una corrida dura varios minutos y no debe perderse
 * por un corte momentáneo. Los errores HTTP (400, 429...) se devuelven tal cual.
 */
async function fetchRetry(url, options) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt >= 6) throw error;
      const wait = 3000 * attempt;
      console.log(`  (sin conexión: ${error.cause?.code ?? error.message}; reintento ${attempt} en ${wait / 1000} s)`);
      await sleep(wait);
    }
  }
}

// Ubicaciones ya encontradas, guardadas en la carpeta temporal del sistema (no
// en el repositorio): si la corrida se corta, la siguiente no repite lo hecho.
// Para volver a buscarlas desde cero (por ejemplo si se corrigió un nombre en
// cities.ts o OpenStreetMap mejoró), borrar ese archivo antes de correr.
const CACHE_FILE = join(tmpdir(), 'lt-city-geocode-cache.json');
function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}
const geocodeCache = loadCache();

/** El depósito, leído de src/routing/geo.ts: una sola fuente de verdad, sin copiar números. */
function readDepot() {
  const src = readFileSync(join(here, '..', 'src', 'routing', 'geo.ts'), 'utf8');
  const m = src.match(/export const DEPOT[\s\S]*?lat:\s*(-?\d+(?:\.\d+)?),\s*lng:\s*(-?\d+(?:\.\d+)?)/);
  if (!m) throw new Error('No se encontró DEPOT en src/routing/geo.ts');
  return { lat: Number(m[1]), lon: Number(m[2]) };
}
const BASE = readDepot();
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Lee cities.ts como texto: cada ciudad con el departamento de su sección. */
function readCities() {
  const src = readFileSync(join(here, 'cities.ts'), 'utf8');
  const out = [];
  let dept = null;
  for (const line of src.split(/\r?\n/)) {
    const header = line.match(/\/\/\s*---\s*(.+?)\s*---/);
    if (header) {
      dept = DEPARTAMENTOS[header[1]];
      if (!dept) throw new Error(`Departamento desconocido en cities.ts: ${header[1]}`);
      continue;
    }
    for (const m of line.matchAll(/"([^"]+)"/g)) out.push({ name: m[1], dept });
  }
  return out;
}

async function geocode(name, dept) {
  const cacheKey = `${name}|${dept}`;
  if (cacheKey in geocodeCache) return geocodeCache[cacheKey];
  const found = await geocodeFresh(name, dept);
  geocodeCache[cacheKey] = found;
  writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache));
  return found;
}

async function geocodeFresh(name, dept) {
  const attempts = [
    { city: name, state: dept, country: 'Paraguay' },
    { q: `${name}, ${dept}, Paraguay` },
    { q: `${name}, Paraguay` },
  ];
  for (const params of attempts) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ ...params, countrycodes: 'py', format: 'json', limit: '1' });
    const res = await fetchRetry(url, { headers: { 'User-Agent': USER_AGENT } });
    await sleep(1100);
    if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`);
    const [hit] = await res.json();
    if (!hit) continue;
    // Una ciudad homónima de otro departamento (hay varias "Santa Rosa",
    // "San Miguel"...) daría una distancia totalmente equivocada.
    const sameDept = norm(hit.display_name).includes(norm(dept));
    return { lat: Number(hit.lat), lon: Number(hit.lon), sameDept, found: hit.display_name };
  }
  return null;
}

/** km por ruta desde BASE hasta un punto (null si no hay ruta). Reintenta si el servicio pide esperar. */
async function roadKmTo(point) {
  const url = new URL('https://api.geoapify.com/v1/routing');
  url.searchParams.set('waypoints', `${BASE.lat},${BASE.lon}|${point.lat},${point.lon}`);
  url.searchParams.set('mode', 'drive');
  url.searchParams.set('format', 'json');
  url.searchParams.set('apiKey', GEOAPIFY_API_KEY);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetchRetry(url);
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * attempt);
      continue;
    }
    // Nunca se imprime la URL: lleva la clave.
    if (!res.ok) {
      const message = (await res.json().catch(() => ({}))).message ?? '';
      // Punto sin calles cerca (localidad ubicada en pleno campo): esa ciudad
      // queda sin km, como el resto de las que no tienen ruta, y se sigue.
      if (res.status === 400 && /no suitable edges|no route|not found/i.test(message)) return null;
      throw new Error(`Geoapify respondió ${res.status}: ${message}`);
    }
    const meters = (await res.json()).results?.[0]?.distance;
    return typeof meters === 'number' ? meters / 1000 : null;
  }
  throw new Error('Geoapify sigue pidiendo esperar: volvé a correr el script en unos minutos.');
}

async function roadKm(points) {
  const result = [];
  for (const [i, p] of points.entries()) {
    result.push(await roadKmTo(p));
    if ((i + 1) % 50 === 0) console.log(`  rutas: ${i + 1} de ${points.length}`);
    await sleep(250);
  }
  return result;
}

/** Los km de la tabla vigente (antes de regenerarla), para mostrar qué cambió. */
function readCurrentTable() {
  const file = join(here, '..', 'src', 'cities', 'city-distances.ts');
  const table = {};
  for (const m of readFileSync(file, 'utf8').matchAll(/"([^"]+)":\s*([\d.]+),/g)) table[m[1]] = Number(m[2]);
  return table;
}
const previous = readCurrentTable();

const cities = readCities();
console.log(`Ubicando ${cities.length} ciudades...`);
const located = [];
const problems = [];
for (const c of cities) {
  if (KNOWN_WRONG.has(c.name)) {
    problems.push(`EXCLUIDA A MANO: ${c.name}`);
    continue;
  }
  const g = ANCHORS[c.name] ?? (await geocode(c.name, c.dept));
  if (!g) problems.push(`NO ENCONTRADA: ${c.name} (${c.dept})`);
  else {
    if (!g.sameDept) problems.push(`OTRO DEPARTAMENTO: ${c.name} (${c.dept}) → ${g.found}`);
    located.push({ ...c, ...g });
  }
}
const kms = await roadKm(located);
const rows = located
  .map((c, i) => ({ name: c.name, km: kms[i], ok: c.sameDept }))
  .filter((r) => {
    if (r.km == null) problems.push(`SIN RUTA: ${r.name}`);
    return r.km != null && r.ok;
  });

const body = rows.map((r) => `  ${JSON.stringify(r.name)}: ${r.km.toFixed(1)},`).join('\n');
writeFileSync(
  join(here, '..', 'src', 'cities', 'city-distances.ts'),
  `// Generado por prisma/compute-city-distances.mjs — no editar a mano.\n` +
    `// Km POR RUTA desde el depósito (DEPOT en src/routing/geo.ts) hasta el centro de\n` +
    `// cada ciudad: ubicaciones de OpenStreetMap, rutas de Geoapify. Las que no se\n` +
    `// pudieron ubicar con certeza no están: su distancia se carga a mano en el\n` +
    `// panel (Zonas de Entrega).\n` +
    `export const cityRoadKm: Record<string, number> = {\n${body}\n};\n`,
);
console.log(`Listo: ${rows.length} de ${cities.length} ciudades con distancia (desde ${BASE.lat}, ${BASE.lon}).`);

// Resumen de cambios contra la tabla anterior: lo que se aleja mucho merece una mirada.
const deltas = rows.filter((r) => previous[r.name] !== undefined).map((r) => ({ name: r.name, old: previous[r.name], now: Number(r.km.toFixed(1)) }));
if (deltas.length) {
  const diffs = deltas.map((d) => d.now - d.old);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  console.log(`Cambio promedio: ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} km (mín ${Math.min(...diffs).toFixed(1)}, máx ${Math.max(...diffs).toFixed(1)}).`);
  const big = deltas.filter((d) => Math.abs(d.now - d.old) > 5);
  if (big.length) console.log(`Cambian más de 5 km (revisar):\n  ${big.map((d) => `${d.name}: ${d.old} → ${d.now}`).join('\n  ')}`);
}
const dropped = Object.keys(previous).filter((n) => !rows.some((r) => r.name === n));
if (dropped.length) console.log(`Tenían km antes y ahora NO (revisar):\n  ${dropped.join('\n  ')}`);
if (problems.length) console.log(`Para revisar (${problems.length}):\n  ${problems.join('\n  ')}`);
