// Paso 1 del benchmark: genera problemas al azar y los resuelve con NUESTRO optimizador.
// Requiere haber compilado el backend (npm run build).
//
//   node tools/planner-benchmark/generate.cjs <carpeta de salida>
//
// Escribe un instances.json con cada problema y nuestro plan. El paso 2
// (reference_ortools.py) resuelve los mismos problemas con OR-Tools de Google y
// compara los costos con la MISMA función objetivo.
const fs = require('node:fs');
const path = require('node:path');
const { solve } = require('../../dist/routing/planner/planner.js');
const { makeRng } = require('../../dist/routing/planner/ils.js');

const out = process.argv[2];
if (!out)
  throw new Error('Falta la carpeta de salida: node generate.cjs <carpeta>');
fs.mkdirSync(out, { recursive: true });

const HOUR = 3600;
const MIN = 60;

/** Mismos supuestos que las pruebas: puntos en 30×30 km, 30 km/h, ida y vuelta algo distintas. */
function randomProblem(seed, n, vehicles, windowShare) {
  const rng = makeRng(seed);
  const pts = Array.from({ length: n + 1 }, () => [
    rng.next() * 30,
    rng.next() * 30,
  ]);
  const travelSec = [];
  const distanceM = [];
  for (let i = 0; i <= n; i++) {
    travelSec.push([]);
    distanceM.push([]);
    for (let j = 0; j <= n; j++) {
      const km =
        i === j
          ? 0
          : Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * 1.3;
      const asym = i < j ? 1 : 1.07;
      travelSec[i].push(Math.round((km / 30) * 3600 * asym));
      distanceM[i].push(Math.round(km * 1000 * asym));
    }
  }
  const startSec = 8 * HOUR;
  const stops = Array.from({ length: n }, (_, i) => {
    const stop = {
      id: `S${i + 1}`,
      node: i + 1,
      serviceSec: (10 + rng.int(21)) * MIN,
    };
    if (rng.next() < windowShare) {
      const from = startSec + rng.int(5 * 4) * 15 * MIN;
      stop.window = {
        fromSec: from,
        toSec: from + (30 + rng.int(7) * 15) * MIN,
      };
    }
    return stop;
  });
  return { startSec, travelSec, distanceM, stops, vehicles };
}

const sizes = [10, 20, 40];
const vehiclesList = [1, 2];
const windowShares = [0, 0.4];
const perConfig = Number(process.env.PER_CONFIG || 5);

const instances = [];
let seed = 90000;
for (const n of sizes) {
  for (const vehicles of vehiclesList) {
    for (const windowShare of windowShares) {
      for (let k = 0; k < perConfig; k++) {
        const problem = randomProblem(++seed, n, vehicles, windowShare);
        const t = performance.now();
        const plan = solve(problem); // configuración por defecto, la misma que usa el sistema
        const ms = performance.now() - t;
        instances.push({
          name: `n${n}-v${vehicles}-w${windowShare}-${k}`,
          n,
          vehicles,
          windowShare,
          problem,
          ours: {
            routes: plan.routes.map((r) =>
              r.stops.map((s) => Number(s.id.slice(1)) - 1),
            ),
            ms,
            optimal: plan.optimal,
          },
        });
      }
    }
  }
}
fs.writeFileSync(path.join(out, 'instances.json'), JSON.stringify(instances));
console.log(
  `${instances.length} problemas generados y resueltos con el optimizador propio en ${out}`,
);
