// Herramienta de mantenimiento (no corre en producción): calcula los km POR
// RUTA desde el local hasta cada ciudad de prisma/cities.ts y regenera
// src/cities/city-distances.ts. Volver a correrla solo si el local se muda
// (cambiar BASE) o se agregan ciudades a la lista. Los km nuevos llegan a la
// base de datos por CityDistanceMigration, que corre una sola vez y solo
// completa ciudades sin km: para que se vuelvan a aplicar hay que cambiarle
// el MARKER (y, si el local se mudó, que reemplace también los km viejos).
//
//   node prisma/compute-city-distances.mjs
//
// Usa los servicios públicos de OpenStreetMap: Nominatim (ubicación de cada
// ciudad, máximo 1 consulta por segundo según su política de uso) y OSRM
// (distancia por ruta). Ninguno necesita clave. Tarda unos 5 minutos.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Misma ubicación que BUSINESS.geo en frontend/src/lib/site.ts.
const BASE = { lat: -25.302442669518815, lon: -57.60189306166173 };
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

const here = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const attempts = [
    { city: name, state: dept, country: 'Paraguay' },
    { q: `${name}, ${dept}, Paraguay` },
    { q: `${name}, Paraguay` },
  ];
  for (const params of attempts) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ ...params, countrycodes: 'py', format: 'json', limit: '1' });
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
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

/** km por ruta desde BASE, en tandas (el servidor público acepta ~100 puntos). */
async function roadKm(points) {
  const result = [];
  for (let i = 0; i < points.length; i += 90) {
    const chunk = points.slice(i, i + 90);
    const coords = [BASE, ...chunk].map((p) => `${p.lon},${p.lat}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance`);
    const json = await res.json();
    if (json.code !== 'Ok') throw new Error(`OSRM: ${json.code} ${json.message ?? ''}`);
    result.push(...json.distances[0].slice(1).map((m) => (m == null ? null : m / 1000)));
    await sleep(1000);
  }
  return result;
}

const cities = readCities();
console.log(`Ubicando ${cities.length} ciudades...`);
const located = [];
const problems = [];
for (const c of cities) {
  if (KNOWN_WRONG.has(c.name)) {
    problems.push(`EXCLUIDA A MANO: ${c.name}`);
    continue;
  }
  const g = await geocode(c.name, c.dept);
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
    `// Km POR RUTA desde el local (BUSINESS.geo) hasta el centro de cada ciudad,\n` +
    `// según OpenStreetMap. Las que no se pudieron ubicar con certeza no están:\n` +
    `// su distancia se carga a mano en el panel (Zonas de Entrega).\n` +
    `export const cityRoadKm: Record<string, number> = {\n${body}\n};\n`,
);
console.log(`Listo: ${rows.length} de ${cities.length} ciudades con distancia.`);
if (problems.length) console.log(`Para revisar (${problems.length}):\n  ${problems.join('\n  ')}`);
