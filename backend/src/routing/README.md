# Módulo `routing` — rutas, ubicaciones y reparto

Todo lo que tiene que ver con **dónde** y **en qué orden**: ubicación exacta de
entrega, km por calle, y el plan de reparto de cada día. Está pensado como base
de la futura app de recorridos.

```
routing/
├─ geo.ts                  DEPOT (el depósito), distancias en línea recta, validaciones de coordenadas
├─ parse-location.ts       lee links de Google Maps / Waze / OSM y coordenadas pegadas por el admin
├─ routing.service.ts      locate() = ubicación → km por calle · travelMatrix() = tiempos entre todos los puntos
├─ providers/              RouteProvider (interfaz) + Geoapify (la única implementación hoy)
├─ travel-matrix.ts        matriz aproximada de respaldo, tramos sin ruta, factor de tráfico
├─ planner/                EL OPTIMIZADOR (librería pura, sin Nest ni Prisma)
└─ dispatch/               el plan del día: arma las paradas desde los alquileres, guarda la ruta y el avance
```

## Cómo se arma un plan (`DispatchService.plan`)

1. **Paradas**: entregas de los alquileres activos que arrancan ese día + retiros de
   los que terminan ese día o ya se pasaron (atrasados). Sin ubicación → no entra
   (se informa). Entrega y retiro el mismo día → el retiro exige horario.
2. **Tiempos**: una sola consulta de matriz a Geoapify (`n × min(n,10)` créditos;
   se reutiliza 6 h en memoria). Si falla o no hay clave → estimación en línea
   recta, marcada como "aproximada".
3. **Tráfico**: los tiempos de Geoapify son "sin tráfico"; el plan los multiplica
   por un factor (por defecto ×1,3, **sin calibrar**).
4. **Optimizar** (`planner/`): minimiza `duración + 10 × atraso (+ 0,3 × lo que tarda el último camión si hay varios)`.
5. **Guardar** (opcional): `DeliveryRun` → `DeliveryRoute` (un camión) → `DeliveryStop`
   (con la hora planificada y, después, la **hora real** de llegada y de fin).

## El optimizador (`planner/`)

| Capa | Qué hace |
|---|---|
| `evaluate.ts` | **Define el objetivo.** Todo lo demás lo usa: no pueden contradecirse. |
| `ils.ts` | Heurística: inserción más barata → mejora local (relocate 1–3, swap, 2‑opt, 2‑opt\*) → *destruir y reconstruir* con temple simulado. Semilla fija: mismo problema, mismo plan. |
| `exact.ts` | Held‑Karp (1 camión, sin ventanas, ≤15 paradas), ramificación y poda (con ventanas, ≤10), enumeración (pocos camiones). Dan el **certificado de optimalidad** (`optimal: true`). |
| `planner.ts` | Orquesta: heurística (con reinicios si no hay verificación exacta) + verificación exacta. |

**Calidad medida** (`tools/planner-benchmark/`, 60 problemas de 10–40 paradas):
iguala o mejora a OR‑Tools de Google (1 s) en 58 de 60 y (10 s) en 54 de 60;
contra el **óptimo verdadero** (fuerza bruta, 9 paradas, 2 camiones) acertó 8 de 8.
Peor caso conocido: ventanas horarias casi imposibles con 40 paradas y 1 camión
(+7,9 % frente a OR‑Tools; una semilla distinta lo resuelve).

Se vuelve a medir con:

```
npm run build
node tools/planner-benchmark/generate.cjs <carpeta>
python tools/planner-benchmark/reference_ortools.py <carpeta>     # pip install ortools
```

## Límites conocidos (a propósito, para una próxima etapa)

- Máx. **30 paradas por plan** (una matriz de Geoapify admite 31 puntos).
- **Sin precedencias**: no fuerza que un retiro vaya después de su entrega; lo
  detecta y avisa (`buildWarnings`).
- Los **tiempos de atención** (`dispatch.ts › serviceMinutes`) y el **factor de
  tráfico** son valores de partida. La hora real de cada parada ya se guarda
  (`arrivedAt`/`completedAt`) justamente para calibrarlos.
- Sin tráfico en vivo (Geoapify no lo ofrece). Google Maps Platform sí, pero pide
  tarjeta, su cupo gratis es chico y **prohíbe guardar** sus resultados.
- El cálculo corre en el hilo principal (~1 s como máximo, con tope de tiempo):
  alcanza para un administrador; con más carga convendría un worker.
- Geoapify: el plan gratis exige "Powered by Geoapify" + atribución a
  OpenStreetMap (el panel ya los muestra) y permite uso comercial "con algunas
  limitaciones" en producción, sin detallarlas: **conviene confirmarlo con ellos**.

## Para la app de recorridos

`planner/` no depende de nada del sistema: recibe matrices y paradas, devuelve el
plan. `RoutingService` y `DispatchService` están exportados por el módulo. Para
cambiar de servicio de rutas se escribe otro `RouteProvider`; para sumar OR‑Tools
o VROOM como solver externo, se agrega otro adaptador con la misma firma que
`solve(problem)`.
