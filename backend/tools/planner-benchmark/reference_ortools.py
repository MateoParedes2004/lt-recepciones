"""Paso 2 del benchmark: resuelve los mismos problemas con OR-Tools (de Google) y compara.

    python reference_ortools.py <carpeta con instances.json>

Requiere:  pip install ortools

La comparación es justa porque el costo de AMBOS planes (el nuestro y el de
OR-Tools) lo recalcula la misma función `plan_cost`, que implementa el objetivo
del optimizador:
    costo = suma de duraciones de cada ruta (salida -> regreso, con esperas y
            atención) + 10 x atraso total + 0,3 x duración de la ruta más larga
            (el 0,3 solo con más de un camión).
"""
import json
import os
import sys
import statistics
from concurrent.futures import ProcessPoolExecutor

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

LATE_WEIGHT = 10
SCALE = 10  # OR-Tools trabaja con enteros: todo se multiplica por 10 para poder usar 0,3 = 3/10


def plan_cost(problem, routes):
    """El objetivo, calculado desde cero para un plan (lista de rutas = lista de índices de parada)."""
    stops = problem["stops"]
    travel = problem["travelSec"]
    w = 0.3 if problem["vehicles"] > 1 else 0.0
    total, longest = 0.0, 0.0
    for route in routes:
        if not route:
            continue
        t, at, late = problem["startSec"], 0, 0.0
        for s in route:
            stop = stops[s]
            t += travel[at][stop["node"]]
            win = stop.get("window")
            if win:
                if t < win["fromSec"]:
                    t = win["fromSec"]
                elif t > win["toSec"]:
                    late += t - win["toSec"]
            t += stop["serviceSec"]
            at = stop["node"]
        t += travel[at][0]
        dur = t - problem["startSec"]
        total += dur + LATE_WEIGHT * late
        longest = max(longest, dur)
    return total + w * longest


def solve_ortools(problem, seconds):
    stops = problem["stops"]
    n = len(stops)
    vehicles = problem["vehicles"]
    travel = problem["travelSec"]
    horizon = 4 * 24 * 3600

    manager = pywrapcp.RoutingIndexManager(n + 1, vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def transit(from_index, to_index):
        i, j = manager.IndexToNode(from_index), manager.IndexToNode(to_index)
        service = stops[i - 1]["serviceSec"] if i > 0 else 0
        return int(round((travel[i][j] + service) * SCALE))

    cb = routing.RegisterTransitCallback(transit)
    routing.AddDimension(cb, horizon * SCALE, horizon * SCALE, False, "Time")
    time = routing.GetDimensionOrDie("Time")

    start = problem["startSec"] * SCALE
    for v in range(vehicles):
        time.CumulVar(routing.Start(v)).SetRange(start, start)
    for i, stop in enumerate(stops, start=1):
        idx = manager.NodeToIndex(i)
        win = stop.get("window")
        if win:
            time.CumulVar(idx).SetRange(win["fromSec"] * SCALE, horizon * SCALE)
            # El exceso ya está en unidades escaladas (x SCALE) y la duración también: el coeficiente es LATE_WEIGHT a secas
            # (multiplicarlo otra vez por SCALE penalizaría el atraso 10 veces más de lo que dice el objetivo).
            time.SetCumulVarSoftUpperBound(idx, win["toSec"] * SCALE, LATE_WEIGHT)

    # costo = duración de cada ruta (en vez de la suma de arcos, que cuenta igual el viaje y la atención)
    # Se anula el costo por arco y se cobra el span de la dimensión (incluye esperas).
    zero = routing.RegisterTransitCallback(lambda a, b: 0)
    routing.SetArcCostEvaluatorOfAllVehicles(zero)
    time.SetSpanCostCoefficientForAllVehicles(1)
    if vehicles > 1:
        time.SetGlobalSpanCostCoefficient(3)  # 0,3 x SCALE

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(seconds)
    solution = routing.SolveWithParameters(params)
    if not solution:
        return None
    routes = []
    for v in range(vehicles):
        idx, route = routing.Start(v), []
        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            if node > 0:
                route.append(node - 1)
            idx = solution.Value(routing.NextVar(idx))
        routes.append(route)
    return routes


def run(inst):
    problem = inst["problem"]
    ours = plan_cost(problem, inst["ours"]["routes"])
    cached = inst.get("_or")
    r1 = cached["r1"] if cached else solve_ortools(problem, 1)
    r10 = cached["r10"] if cached else solve_ortools(problem, 10)
    return {
        "name": inst["name"], "n": inst["n"], "vehicles": inst["vehicles"], "windowShare": inst["windowShare"],
        "ours": ours, "oursMs": inst["ours"]["ms"], "oursOptimal": inst["ours"]["optimal"],
        "or1": plan_cost(problem, r1) if r1 else None, "or10": plan_cost(problem, r10) if r10 else None,
        "_routes": {"r1": r1, "r10": r10},
    }


def pct(a, b):
    return (a - b) / b * 100.0


if __name__ == "__main__":
    folder = sys.argv[1]
    instances = json.load(open(f"{folder}/instances.json", encoding="utf-8"))
    if os.environ.get("REUSE") == "1":  # reutiliza las soluciones de OR-Tools de la corrida anterior (por nombre)
        previous = {r["name"]: r["_routes"] for r in json.load(open(f"{folder}/results.json", encoding="utf-8"))}
        for inst in instances:
            inst["_or"] = previous.get(inst["name"])
    with ProcessPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(run, instances))
    json.dump(rows, open(f"{folder}/results.json", "w", encoding="utf-8"))

    print(f"{len(rows)} problemas. Diferencia = cuánto MÁS cuesta el plan propio que el de OR-Tools (negativo = el propio es mejor).\n")
    groups = {}
    for r in rows:
        groups.setdefault((r["n"], r["vehicles"], r["windowShare"]), []).append(r)
    print(f'{"paradas":>7} {"camiones":>8} {"ventanas":>8} | {"vs OR-Tools 1 s":>26} | {"vs OR-Tools 10 s":>26} | {"tiempo propio":>13}')
    for key in sorted(groups):
        g = groups[key]
        d1 = [pct(r["ours"], r["or1"]) for r in g if r["or1"]]
        d10 = [pct(r["ours"], r["or10"]) for r in g if r["or10"]]
        print(f'{key[0]:>7} {key[1]:>8} {"sí" if key[2] else "no":>8} | '
              f'media {statistics.mean(d1):+6.2f}%  peor {max(d1):+6.2f}% | '
              f'media {statistics.mean(d10):+6.2f}%  peor {max(d10):+6.2f}% | {statistics.mean(r["oursMs"] for r in g):>9.0f} ms')
    all1 = [pct(r["ours"], r["or1"]) for r in rows if r["or1"]]
    all10 = [pct(r["ours"], r["or10"]) for r in rows if r["or10"]]
    eps = 1e-6
    for label, ds in (("OR-Tools 1 s", all1), ("OR-Tools 10 s", all10)):
        wins = sum(1 for d in ds if d < -eps)
        ties = sum(1 for d in ds if abs(d) <= eps)
        loses = sum(1 for d in ds if d > eps)
        print(f"\nvs {label}: propio mejor en {wins}, igual en {ties}, peor en {loses} de {len(ds)} · diferencia media {statistics.mean(ds):+.2f}% · mediana {statistics.median(ds):+.2f}% · peor caso {max(ds):+.2f}%")
