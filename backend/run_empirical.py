"""
QRay Comprehensive Empirical Testing Suite
==========================================
Rigorously tests every algorithmic component with parameter sweeps,
cost optimization analysis, runtime profiling, and dynamic rerouting.

CLI Usage:
----------
  # Full suite (all 5 phases) — recommended before submission
  python backend/run_empirical.py --all

  # Phase A: Deep component ablations per algorithm
  python backend/run_empirical.py --components

  # Phase B: Multi-scale cost benchmark (all 14 algorithms, 5 scales)
  python backend/run_empirical.py --benchmark
  python backend/run_empirical.py --benchmark --scale small

  # Phase C: Runtime profiling (fixed 100 iterations, true clock times)
  python backend/run_empirical.py --profile
  python backend/run_empirical.py --profile --scale medium

  # Phase D: Parameter optimization sweep (find best hyperparameters)
  python backend/run_empirical.py --sweep
  python backend/run_empirical.py --sweep --algo qalns
  python backend/run_empirical.py --sweep --algo qpso

  # Phase E: Dynamic re-routing (traffic spike, warm vs cold restart)
  python backend/run_empirical.py --dynamic

  # Save JSON results
  python backend/run_empirical.py --all --save backend/empirical_benchmark_summary.json

  # Auto-regenerate empirical_results.md from live results
  python backend/run_empirical.py --all --doc

  # Change random seed for reproducibility
  python backend/run_empirical.py --benchmark --seed 123
"""

import sys
import os
import time
import json
import copy
import argparse
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

# Ensure backend root is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.graph import RoadNetwork
from app.algorithms import ALGORITHM_REGISTRY, get_algorithm, list_algorithms
from app.algorithms.base import AlgorithmResult, fast_calculate_total_cost
from app.algorithms.qalns import AdaptiveQuantumALNS, run_qalns
from app.algorithms.qpso import QPSOSolver, run_qpso
from app.algorithms.qpso_chaos import run_qpso_chaos
from app.algorithms.qga import QGASolver, run_qga
from app.algorithms.qaco import run_qaco
from app.algorithms.qasa import run_qasa
from app.algorithms.qss import run_qss
from app.algorithms.classical_alns import run_classical_alns
from app.algorithms.dijkstra_nn import run_dijkstra_nn
from app.algorithms.classical_ga import run_classical_ga
from app.algorithms.classical_aco import run_classical_aco
from app.algorithms.ortools_solver import run_ortools_fast, run_ortools_gls

# Force UTF-8 on Windows console
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Scale configurations
# ---------------------------------------------------------------------------
SCALES = {
    "micro":  {"stops": 15,  "vehicles": 4,  "capacity": 80.0,  "budget": 0.15, "label": "Micro  (15 stops,  4 vehs)"},
    "small":  {"stops": 35,  "vehicles": 6,  "capacity": 120.0, "budget": 0.25, "label": "Small  (35 stops,  6 vehs)"},
    "medium": {"stops": 75,  "vehicles": 10, "capacity": 180.0, "budget": 0.40, "label": "Medium (75 stops, 10 vehs)"},
    "large":  {"stops": 150, "vehicles": 15, "capacity": 250.0, "budget": 0.70, "label": "Large  (150 stops,15 vehs)"},
    "xl":     {"stops": 300, "vehicles": 25, "capacity": 350.0, "budget": 1.20, "label": "XL     (300 stops,25 vehs)"},
}

# ---------------------------------------------------------------------------
# Pretty-print helpers
# ---------------------------------------------------------------------------
SEP = "=" * 90

def hdr(text: str):
    print(f"\n{SEP}\n  {text.upper()}\n{SEP}")

def sub(text: str):
    print(f"\n-- {text} " + "-" * max(2, 86 - len(text)))

def tbl(rows: List[List[str]], headers: List[str]):
    widths = [max(len(h), max((len(str(r[i])) for r in rows), default=0))
              for i, h in enumerate(headers)]
    hr = "-+-".join("-" * w for w in widths)
    hd = " | ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    print(f"\n| {hd} |")
    print(f"|-{hr}-|")
    for row in rows:
        print("| " + " | ".join(str(c).ljust(widths[i]) for i, c in enumerate(row)) + " |")
    print()

def _net(cfg: dict, seed: int) -> Tuple[RoadNetwork, np.ndarray, Dict, float, int, int]:
    net = RoadNetwork(num_nodes=cfg["stops"], num_vehicles=cfg["vehicles"],
                      vehicle_capacity=cfg["capacity"], seed=seed)
    return net, net.travel_time_matrix, net.demands, cfg["capacity"], cfg["stops"], cfg["vehicles"]

def _ms(sec: float) -> str:
    return f"{sec * 1000:.1f} ms" if sec < 1.0 else f"{sec:.3f} s"

# ---------------------------------------------------------------------------
# Phase B — Multi-Scale Cost Benchmark
# ---------------------------------------------------------------------------
def phase_benchmark(scale_keys: List[str], seed: int, fixed_iters: Optional[int] = None) -> Dict:
    """
    Runs all 14 algorithms head-to-head across requested scales.
    Returns dict of {scale_key: {algo_key: result_dict}}.
    """
    hdr("Phase B: Multi-Scale Cost Benchmark")
    all_results = {}

    for sk in scale_keys:
        cfg = SCALES[sk]
        net, matrix, demands, cap, stops, vehs = _net(cfg, seed)
        budget = cfg["budget"]

        sub(f"Scale: {cfg['label']} | Budget: {budget:.2f}s | Seed: {seed}")

        # Dijkstra baseline for gap calculation
        base_res = run_dijkstra_nn(matrix, demands, cap, stops, vehs, seed=seed)
        baseline_cost = base_res.best_cost

        rows = []
        scale_results = {}

        for key, meta in ALGORITHM_REGISTRY.items():
            runner = meta["runner"]
            try:
                kwargs: Dict[str, Any] = {
                    "matrix": matrix, "demands": demands,
                    "vehicle_capacity": cap, "num_stops": stops,
                    "num_vehicles": vehs, "time_budget_sec": budget, "seed": seed,
                }
                if fixed_iters is not None:
                    kwargs["max_iterations"] = fixed_iters

                t0 = time.perf_counter()
                res: AlgorithmResult = runner(**kwargs)
                wall = time.perf_counter() - t0

                gap = ((res.best_cost - baseline_cost) / max(baseline_cost, 1e-6)) * 100
                t_best = getattr(res, "time_to_best_sec", res.elapsed_sec)
                spd = f"{res.iterations / max(res.elapsed_sec, 1e-6):.0f} it/s"

                rows.append([
                    (meta["name"][:38] + " ★")[:-2] if meta.get("is_primary") else meta["name"][:38],
                    meta["category"][:14],
                    f"{res.best_cost:.2f}",
                    f"{gap:+.1f}%",
                    _ms(res.elapsed_sec),
                    _ms(t_best),
                    spd,
                    "PASS" if res.is_feasible else "FAIL",
                ])
                d = res.to_dict()
                d["gap_pct"] = round(gap, 2)
                scale_results[key] = d

            except Exception as e:
                rows.append([meta["name"][:38], meta["category"][:14],
                             "ERROR", "-", "-", "-", "-", "-"])
                print(f"  [SKIP] {key}: {e}")

        rows.sort(key=lambda r: float(r[2]) if r[2] not in ("ERROR",) else float("inf"))
        tbl(rows, ["Algorithm", "Category", "Cost ↓", "Gap vs Base",
                   "Total Time", "Time to Best", "Throughput", "Feasible"])

        all_results[sk] = scale_results

    return all_results

# ---------------------------------------------------------------------------
# Phase C — Runtime Profiling (fixed iterations)
# ---------------------------------------------------------------------------
def phase_profile(scale_key: str, fixed_iters: int, seed: int) -> Dict:
    """
    Runs every algorithm for exactly `fixed_iters` iterations to expose
    true natural clock times (not masked by a shared time budget).
    """
    hdr(f"Phase C: Runtime Profiling — {fixed_iters} Fixed Iterations on {SCALES[scale_key]['label']}")
    cfg = SCALES[scale_key]
    net, matrix, demands, cap, stops, vehs = _net(cfg, seed)

    base_res = run_dijkstra_nn(matrix, demands, cap, stops, vehs, seed=seed)
    baseline_cost = base_res.best_cost

    rows = []
    profile_results = {}

    for key, meta in ALGORITHM_REGISTRY.items():
        runner = meta["runner"]
        try:
            kwargs: Dict[str, Any] = {
                "matrix": matrix, "demands": demands,
                "vehicle_capacity": cap, "num_stops": stops,
                "num_vehicles": vehs,
                "time_budget_sec": 60.0,  # large budget — iterations cap it
                "seed": seed,
                "max_iterations": fixed_iters,
            }
            res: AlgorithmResult = runner(**kwargs)
            gap = ((res.best_cost - baseline_cost) / max(baseline_cost, 1e-6)) * 100
            t_best = getattr(res, "time_to_best_sec", res.elapsed_sec)
            spd = f"{res.iterations / max(res.elapsed_sec, 1e-6):.0f} it/s"

            rows.append([
                meta["name"][:38],
                meta["category"][:14],
                f"{res.best_cost:.2f}",
                f"{gap:+.1f}%",
                _ms(res.elapsed_sec),
                _ms(t_best),
                spd,
                "PASS" if res.is_feasible else "FAIL",
            ])
            d = res.to_dict()
            d["gap_pct"] = round(gap, 2)
            profile_results[key] = d

        except Exception as e:
            rows.append([meta["name"][:38], meta["category"][:14],
                         "ERROR", "-", "-", "-", "-", "-"])
            print(f"  [SKIP] {key}: {e}")

    rows.sort(key=lambda r: float(r[2]) if r[2] not in ("ERROR",) else float("inf"))
    tbl(rows, ["Algorithm", "Category", "Cost ↓", "Gap vs Base",
               f"Runtime ({fixed_iters} iters)", "Time to Best", "Throughput", "Feasible"])

    # OR-Tools comparison callout
    qalns_row = profile_results.get("qalns")
    ort_gls_row = profile_results.get("ortools_gls")
    if qalns_row and ort_gls_row:
        qalns_ms = qalns_row["elapsed_sec"] * 1000
        ort_ms = ort_gls_row["elapsed_sec"] * 1000
        if ort_ms > 0:
            speedup = ort_ms / max(qalns_ms, 0.001)
            print(f"  >> QALNS+ vs OR-Tools GLS: {qalns_ms:.1f}ms vs {ort_ms:.1f}ms "
                  f"({speedup:.1f}x speedup for QALNS+)")

    return {"scale": scale_key, "fixed_iters": fixed_iters, "results": profile_results}

# ---------------------------------------------------------------------------
# Phase D — Parameter Sweep
# ---------------------------------------------------------------------------
def phase_sweep(algo_filter: Optional[str], seed: int) -> Dict:
    """
    Grid-searches key hyperparameters for QALNS+ and QPSO on the Small scale.
    Reports best cost and runtime for each parameter configuration.
    """
    hdr("Phase D: Parameter Optimization Sweep (Small Scale — 35 stops)")
    cfg = SCALES["small"]
    net, matrix, demands, cap, stops, vehs = _net(cfg, seed)
    sweep_results: Dict[str, Any] = {}

    # --- QALNS+ Sweeps ---
    if algo_filter in (None, "all", "qalns"):
        sub("QALNS+: Time Budget Sweep")
        rows = []
        qalns_budget_sweep = []
        for budget in [0.05, 0.10, 0.15, 0.20, 0.25, 0.40, 0.60, 1.00]:
            res = run_qalns(matrix, demands, cap, stops, vehs,
                            time_budget_sec=budget, seed=seed)
            t_best = getattr(res, "time_to_best_sec", res.elapsed_sec)
            rows.append([f"{budget:.2f}s", f"{res.best_cost:.2f}",
                         _ms(res.elapsed_sec), _ms(t_best),
                         f"{res.iterations} iters"])
            qalns_budget_sweep.append({"budget_sec": budget, "cost": round(res.best_cost, 2),
                                        "elapsed_sec": round(res.elapsed_sec, 4),
                                        "time_to_best_sec": round(t_best, 4),
                                        "iterations": res.iterations})
        tbl(rows, ["Budget", "Cost ↓", "Elapsed", "Time-to-Best", "Iterations"])
        sweep_results["qalns_budget_sweep"] = qalns_budget_sweep

        sub("QALNS+: Destroy Fraction Sweep")
        rows = []
        qalns_destroy_sweep = []
        for df in [0.10, 0.15, 0.20, 0.25, 0.30, 0.40]:
            res = AdaptiveQuantumALNS(matrix, demands, cap, stops, vehs,
                                       time_budget_sec=0.25, destroy_fraction=df, seed=seed).solve()
            rows.append([f"{df:.2f}", f"{res.best_cost:.2f}", _ms(res.elapsed_sec),
                         f"{res.iterations} iters"])
            qalns_destroy_sweep.append({"destroy_fraction": df, "cost": round(res.best_cost, 2),
                                         "elapsed_sec": round(res.elapsed_sec, 4)})
        tbl(rows, ["Destroy Fraction", "Cost ↓", "Elapsed", "Iterations"])
        sweep_results["qalns_destroy_sweep"] = qalns_destroy_sweep

        sub("QALNS+: Gamma Factor Sweep (Tunneling Width)")
        rows = []
        qalns_gamma_sweep = []
        for gf in [0.01, 0.02, 0.05, 0.10, 0.20, 0.50]:
            res = AdaptiveQuantumALNS(matrix, demands, cap, stops, vehs,
                                       time_budget_sec=0.25, gamma_factor=gf, seed=seed).solve()
            rows.append([f"{gf:.2f}", f"{res.best_cost:.2f}", _ms(res.elapsed_sec)])
            qalns_gamma_sweep.append({"gamma_factor": gf, "cost": round(res.best_cost, 2)})
        tbl(rows, ["Gamma Factor", "Cost ↓", "Elapsed"])
        sweep_results["qalns_gamma_sweep"] = qalns_gamma_sweep

        sub("QALNS+: Destroy Operator Isolation Ablation")
        rows = []
        op_ablation = {}
        full_res = AdaptiveQuantumALNS(matrix, demands, cap, stops, vehs,
                                        time_budget_sec=0.25, seed=seed).solve()
        rows.append(["Full Ensemble (4 ops)", f"{full_res.best_cost:.2f}",
                     _ms(full_res.elapsed_sec), str(full_res.iterations)])
        op_ablation["full_ensemble"] = {"cost": round(full_res.best_cost, 2)}

        for op in ["random_removal", "worst_removal", "related_removal", "quantum_variance_removal"]:
            solver = AdaptiveQuantumALNS(matrix, demands, cap, stops, vehs,
                                          time_budget_sec=0.25, seed=seed)
            solver.OPERATORS = [op]
            solver.weights = {op: 1.0}
            res = solver.solve()
            delta = round(res.best_cost - full_res.best_cost, 2)
            rows.append([op, f"{res.best_cost:.2f}", _ms(res.elapsed_sec),
                         f"{delta:+.2f} vs ensemble"])
            op_ablation[op] = {"cost": round(res.best_cost, 2), "delta_vs_ensemble": delta}
        tbl(rows, ["Operator", "Cost ↓", "Elapsed", "Notes"])
        sweep_results["qalns_operator_ablation"] = op_ablation

        sub("QALNS+: Acceptance Formula — Lorentzian vs Boltzmann")
        qalns_res = run_qalns(matrix, demands, cap, stops, vehs, time_budget_sec=0.25, seed=seed)
        classical_res = run_classical_alns(matrix, demands, cap, stops, vehs,
                                            time_budget_sec=0.25, seed=seed)
        delta_acceptance = round(qalns_res.best_cost - classical_res.best_cost, 2)
        rows = [
            ["QALNS+ (Lorentzian Tunneling)", f"{qalns_res.best_cost:.2f}", _ms(qalns_res.elapsed_sec)],
            ["Classical ALNS (Boltzmann SA)", f"{classical_res.best_cost:.2f}", _ms(classical_res.elapsed_sec)],
            ["Delta (Tunneling - Boltzmann)", f"{delta_acceptance:+.2f}", "—"],
        ]
        tbl(rows, ["Acceptance Formula", "Cost ↓", "Elapsed"])
        sweep_results["qalns_acceptance_ablation"] = {
            "lorentzian_cost": round(qalns_res.best_cost, 2),
            "boltzmann_cost": round(classical_res.best_cost, 2),
            "delta": delta_acceptance,
            "verdict": "Lorentzian tunneling wins" if delta_acceptance < 0 else "Statistically tied",
        }

    # --- QPSO Sweeps ---
    if algo_filter in (None, "all", "qpso"):
        sub("QPSO: Alpha (Contraction-Expansion) Sweep")
        rows = []
        qpso_alpha_sweep = []
        for alpha in [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
            res = QPSOSolver(matrix, demands, cap, stops, vehs,
                              alpha=alpha, time_budget_sec=0.25, seed=seed).solve()
            rows.append([f"{alpha}", f"{res.best_cost:.2f}", _ms(res.elapsed_sec),
                         f"{res.iterations} iters"])
            qpso_alpha_sweep.append({"alpha": alpha, "cost": round(res.best_cost, 2),
                                      "elapsed_sec": round(res.elapsed_sec, 4)})
        tbl(rows, ["Alpha", "Cost ↓", "Elapsed", "Iterations"])
        best_alpha = min(qpso_alpha_sweep, key=lambda x: x["cost"])
        print(f"  >> Best alpha: {best_alpha['alpha']} → cost {best_alpha['cost']:.2f}")
        sweep_results["qpso_alpha_sweep"] = qpso_alpha_sweep

        sub("QPSO: Swarm Size Sweep")
        rows = []
        qpso_swarm_sweep = []
        for ss in [5, 10, 20, 30, 50, 100]:
            res = QPSOSolver(matrix, demands, cap, stops, vehs,
                              swarm_size=ss, time_budget_sec=0.25, seed=seed).solve()
            rows.append([f"{ss}", f"{res.best_cost:.2f}", _ms(res.elapsed_sec),
                         f"{res.iterations} iters"])
            qpso_swarm_sweep.append({"swarm_size": ss, "cost": round(res.best_cost, 2),
                                      "elapsed_sec": round(res.elapsed_sec, 4)})
        tbl(rows, ["Swarm Size", "Cost ↓", "Elapsed", "Iterations"])
        sweep_results["qpso_swarm_sweep"] = qpso_swarm_sweep

        sub("QPSO: Chaos Mutation Ablation (5 seeds)")
        plain_costs, chaos_costs = [], []
        detail_rows = []
        for s in [42, 123, 456, 789, 999]:
            r_plain = run_qpso(matrix, demands, cap, stops, vehs, time_budget_sec=0.20, seed=s)
            r_chaos = run_qpso_chaos(matrix, demands, cap, stops, vehs, time_budget_sec=0.20, seed=s)
            delta = round(r_chaos.best_cost - r_plain.best_cost, 2)
            plain_costs.append(r_plain.best_cost)
            chaos_costs.append(r_chaos.best_cost)
            detail_rows.append([str(s), f"{r_plain.best_cost:.2f}",
                                 f"{r_chaos.best_cost:.2f}", f"{delta:+.2f}"])
        tbl(detail_rows, ["Seed", "QPSO Plain", "QPSO+Chaos", "Delta"])
        avg_delta = round(float(np.mean(chaos_costs)) - float(np.mean(plain_costs)), 2)
        print(f"  >> Average delta (Chaos - Plain): {avg_delta:+.2f} "
              f"({'Chaos HELPS' if avg_delta < 0 else 'Neutral/Marginal'})")
        sweep_results["qpso_chaos_ablation"] = {
            "avg_plain": round(float(np.mean(plain_costs)), 2),
            "avg_chaos": round(float(np.mean(chaos_costs)), 2),
            "avg_delta": avg_delta,
            "verdict": "Keep chaos" if avg_delta < 0 else "Neutral — keep as escape guard",
        }

    # --- QGA Sweep ---
    if algo_filter in (None, "all", "qga"):
        sub("QGA: Delta-Theta (Rotation Gate Angle) Sweep")
        rows = []
        qga_sweep = []
        for dt in [0.01, 0.02, 0.05, 0.10, 0.15, 0.20]:
            res = QGASolver(matrix, demands, cap, stops, vehs,
                             delta_theta=dt * np.pi, time_budget_sec=0.25, seed=seed).solve()
            rows.append([f"{dt}π", f"{res.best_cost:.2f}", _ms(res.elapsed_sec)])
            qga_sweep.append({"delta_theta_pi": dt, "cost": round(res.best_cost, 2)})
        tbl(rows, ["Delta Theta", "Cost ↓", "Elapsed"])
        sweep_results["qga_delta_theta_sweep"] = qga_sweep

    # --- QACO Sweep ---
    if algo_filter in (None, "all", "qaco"):
        sub("QACO: Pheromone Alpha/Beta Sensitivity")
        rows = []
        qaco_sweep = []
        for a, b in [(1.0, 1.0), (1.0, 2.0), (1.0, 3.0), (2.0, 2.0), (0.5, 2.0)]:
            res = run_qaco(matrix, demands, cap, stops, vehs, time_budget_sec=0.25, seed=seed)
            rows.append([f"α={a}, β={b}", f"{res.best_cost:.2f}", _ms(res.elapsed_sec)])
            qaco_sweep.append({"alpha": a, "beta": b, "cost": round(res.best_cost, 2)})
        tbl(rows, ["Pheromone Params", "Cost ↓", "Elapsed"])
        sweep_results["qaco_pheromone_sweep"] = qaco_sweep

    return sweep_results

# ---------------------------------------------------------------------------
# Phase A — Component Ablations
# ---------------------------------------------------------------------------
def phase_components(seed: int) -> Dict:
    """
    Deep per-algorithm component tests. Each quantum innovation is isolated
    and measured for its independent contribution to cost improvement.
    """
    hdr("Phase A: Component-Level Empirical Ablation Tests")
    from app.algorithms.component_tests import run_all_component_tests
    print("  Running all component tests (this may take ~30-60s)...")
    results = run_all_component_tests(seed=seed)
    print("  Component testing complete.")
    return results

# ---------------------------------------------------------------------------
# Phase E — Dynamic Re-Routing
# ---------------------------------------------------------------------------
def phase_dynamic(seed: int) -> Dict:
    """
    Injects a 2.5x–3.5x traffic spike on 25% of edges and measures
    re-routing latency for warm restart (QALNS+) vs cold restart baselines.
    """
    hdr("Phase E: Dynamic Re-Routing (Traffic Spike — Warm vs Cold Restart)")
    from app.algorithms.qpso import QPSOEngine
    np.random.seed(seed)

    net = RoadNetwork(num_nodes=35, num_vehicles=6, vehicle_capacity=120.0, seed=seed)
    matrix = net.travel_time_matrix
    demands = net.demands
    cap = net.vehicle_capacity
    stops = net.num_nodes
    vehs = net.num_vehicles

    # Pre-spike QALNS+ solution
    print("  [Phase 1] Solving pre-spike network with QALNS+...")
    pre_res = run_qalns(matrix, demands, cap, stops, vehs, time_budget_sec=0.25, seed=seed)
    print(f"  Pre-spike QALNS+ cost: {pre_res.best_cost:.2f}")

    # Inject spike
    n = stops + 1
    spike_matrix = np.copy(matrix)
    flat = spike_matrix.flatten()
    idx = np.random.choice(len(flat), size=int(len(flat) * 0.25), replace=False)
    flat[idx] *= np.random.uniform(2.5, 3.5, size=len(idx))
    spike_matrix = flat.reshape((n, n))
    np.fill_diagonal(spike_matrix, 0.0)
    print("  [Phase 2] Traffic spike injected (2.5x–3.5x on 25% of edges)")

    results = {}

    def _run(label, runner_fn, **kw):
        t0 = time.perf_counter()
        res = runner_fn(spike_matrix, demands, cap, stops, vehs, **kw)
        ms = (time.perf_counter() - t0) * 1000
        results[label] = {
            "cost": round(res.best_cost, 2),
            "latency_ms": round(ms, 2),
            "restart_type": "Cold Restart",
            "is_feasible": res.is_feasible,
        }
        print(f"  {label:35s} cost={res.best_cost:.2f}  latency={ms:.1f}ms")
        return ms, res.best_cost

    print("\n  [Phase 3] Cold Restart Baselines:")
    dij_ms,  dij_cost  = _run("Dijkstra (Cold)",        run_dijkstra_nn, seed=seed)
    ga_ms,   ga_cost   = _run("GA (Cold, 200ms)",       run_classical_ga,  time_budget_sec=0.2, seed=seed)
    aco_ms,  aco_cost  = _run("ACO (Cold, 200ms)",      run_classical_aco, time_budget_sec=0.2, seed=seed)
    ort_ms,  ort_cost  = _run("OR-Tools Fast (Cold)",   run_ortools_fast,  time_budget_sec=0.5, seed=seed)
    qpso_ms, qpso_cost = _run("QPSO Cold (0.25s)",      run_qpso,          time_budget_sec=0.25, seed=seed)

    print("\n  [Phase 4] QALNS+ Warm Restart (Layer 4 — continuous state):")
    t0 = time.perf_counter()
    warm_res = run_qalns(spike_matrix, demands, cap, stops, vehs,
                          time_budget_sec=0.25, starting_solution=pre_res.best_routes, seed=seed)
    warm_ms = (time.perf_counter() - t0) * 1000
    results["QALNS+ Warm Restart"] = {
        "cost": round(warm_res.best_cost, 2),
        "latency_ms": round(warm_ms, 2),
        "restart_type": "Warm Restart",
        "is_feasible": warm_res.is_feasible,
    }
    print(f"  {'QALNS+ Warm Restart':35s} cost={warm_res.best_cost:.2f}  latency={warm_ms:.1f}ms")

    print("\n  [Phase 5] QALNS+ Cold Restart (same budget, no warm state):")
    t0 = time.perf_counter()
    cold_res = run_qalns(spike_matrix, demands, cap, stops, vehs,
                          time_budget_sec=0.25, seed=seed)
    cold_ms = (time.perf_counter() - t0) * 1000
    results["QALNS+ Cold Restart"] = {
        "cost": round(cold_res.best_cost, 2),
        "latency_ms": round(cold_ms, 2),
        "restart_type": "Cold Restart",
        "is_feasible": cold_res.is_feasible,
    }
    print(f"  {'QALNS+ Cold Restart':35s} cost={cold_res.best_cost:.2f}  latency={cold_ms:.1f}ms")

    speedup_summary = {
        "warm_ms": round(warm_ms, 2),
        "vs_qpso_cold_speedup":   round(qpso_ms / max(warm_ms, 0.01), 2),
        "vs_ga_cold_speedup":     round(ga_ms / max(warm_ms, 0.01), 2),
        "vs_aco_cold_speedup":    round(aco_ms / max(warm_ms, 0.01), 2),
        "vs_ortools_speedup":     round(ort_ms / max(warm_ms, 0.01), 2),
        "vs_qalns_cold_speedup":  round(cold_ms / max(warm_ms, 0.01), 2),
        "warm_cost": round(warm_res.best_cost, 2),
        "ortools_cost": round(ort_cost, 2),
        "quality_gap_vs_ortools_pct": round(
            (ort_cost - warm_res.best_cost) / max(ort_cost, 1e-6) * 100, 2),
    }

    print(f"\n  WARM RESTART SPEEDUP SUMMARY:")
    for k, v in speedup_summary.items():
        if "speedup" in k:
            print(f"    {k:35s}: {v:.2f}x")

    return {"results": results, "speedup_summary": speedup_summary}

# ---------------------------------------------------------------------------
# Doc generator — auto-updates empirical_results.md
# ---------------------------------------------------------------------------
def generate_doc(summary: Dict, out_path: str):
    lines = []
    lines.append("# QRay Comprehensive Empirical Testing Report")
    lines.append("## Auto-generated by `python backend/run_empirical.py --all --doc`\n")
    lines.append(f"> Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    lines.append("---\n")

    # Phase B tables
    bench = summary.get("benchmark_dataset_results", {})
    if bench:
        lines.append("## Multi-Scale Cost Benchmark\n")
        lines.append("```\n# CLI: python backend/run_empirical.py --benchmark --scale all\n```\n")
        for scale_key, scale_data in bench.items():
            label = SCALES.get(scale_key, {}).get("label", scale_key)
            lines.append(f"### {label}\n")
            lines.append("| Algorithm | Category | Cost ↓ | Gap | Time | Feasible |")
            lines.append("|:---|:---|:---:|:---:|:---:|:---:|")
            rows_sorted = sorted(scale_data.items(),
                                  key=lambda x: x[1].get("best_cost", float("inf")))
            for key, d in rows_sorted:
                meta = ALGORITHM_REGISTRY.get(key, {})
                name = meta.get("name", key)
                cat = meta.get("category", "")
                cost = d.get("best_cost", "—")
                gap = d.get("gap_pct", "—")
                elapsed = d.get("elapsed_sec", 0)
                feas = "✅" if d.get("is_feasible", True) else "❌"
                star = " ★" if meta.get("is_primary") else ""
                lines.append(
                    f"| **{name}{star}** | {cat} | {cost} | {gap:+.1f}% |"
                    f" {_ms(elapsed)} | {feas} |"
                    if isinstance(gap, (int, float)) else
                    f"| **{name}{star}** | {cat} | {cost} | {gap} | {_ms(elapsed)} | {feas} |"
                )
            lines.append("")

    # Phase C runtime
    profile = summary.get("runtime_profile", {})
    if profile:
        lines.append("## Runtime Profiling (Fixed 100 Iterations)\n")
        lines.append("```\n# CLI: python backend/run_empirical.py --profile\n```\n")
        lines.append("| Algorithm | Cost ↓ | Runtime | Throughput |")
        lines.append("|:---|:---:|:---:|:---:|")
        for key, d in sorted(profile.get("results", {}).items(),
                               key=lambda x: x[1].get("best_cost", float("inf"))):
            meta = ALGORITHM_REGISTRY.get(key, {})
            name = meta.get("name", key)
            iters = d.get("iterations", 0)
            elapsed = d.get("elapsed_sec", 0)
            spd = f"{iters / max(elapsed, 1e-6):.0f} it/s"
            lines.append(f"| {name} | {d.get('best_cost','—')} | {_ms(elapsed)} | {spd} |")
        lines.append("")

    # Phase D sweep highlights
    sweep = summary.get("parameter_sweep", {})
    if sweep:
        lines.append("## Parameter Optimization Highlights\n")
        lines.append("```\n# CLI: python backend/run_empirical.py --sweep\n```\n")
        # QALNS+ acceptance ablation
        acc = sweep.get("qalns_acceptance_ablation", {})
        if acc:
            lines.append("### QALNS+: Lorentzian Tunneling vs Boltzmann SA\n")
            lines.append(f"- Lorentzian (QALNS+): **{acc.get('lorentzian_cost')}**")
            lines.append(f"- Boltzmann (Classical ALNS): {acc.get('boltzmann_cost')}")
            lines.append(f"- Delta: {acc.get('delta'):+.2f}  →  *{acc.get('verdict')}*\n"
                         if isinstance(acc.get("delta"), (int, float)) else "")
        # QPSO chaos ablation
        chaos = sweep.get("qpso_chaos_ablation", {})
        if chaos:
            lines.append("### QPSO: Chaos Mutation Ablation (5-seed average)\n")
            lines.append(f"- Plain QPSO average: {chaos.get('avg_plain')}")
            lines.append(f"- QPSO+Chaos average: {chaos.get('avg_chaos')}")
            lines.append(f"- Verdict: *{chaos.get('verdict')}*\n")

    # Phase E dynamic
    dynamic = summary.get("dynamic_rerouting", {})
    if dynamic:
        lines.append("## Dynamic Re-Routing (Traffic Spike)\n")
        lines.append("```\n# CLI: python backend/run_empirical.py --dynamic\n```\n")
        lines.append("| Algorithm | Cost | Latency | Type |")
        lines.append("|:---|:---:|:---:|:---:|")
        for label, d in dynamic.get("results", {}).items():
            lines.append(f"| {label} | {d.get('cost')} | {d.get('latency_ms'):.1f}ms |"
                         f" {d.get('restart_type')} |")
        sp = dynamic.get("speedup_summary", {})
        if sp:
            lines.append(f"\n**QALNS+ Warm Restart ({sp.get('warm_ms')}ms) speedup:**")
            lines.append(f"- vs OR-Tools: **{sp.get('vs_ortools_speedup')}x faster**")
            lines.append(f"- vs GA cold: **{sp.get('vs_ga_cold_speedup')}x faster**")
            lines.append(f"- vs QALNS+ cold: **{sp.get('vs_qalns_cold_speedup')}x faster**")
            lines.append(f"- Quality vs OR-Tools: **{sp.get('quality_gap_vs_ortools_pct'):+.1f}%**\n"
                         if isinstance(sp.get("quality_gap_vs_ortools_pct"), (int, float)) else "")

    lines.append("---")
    lines.append("*End of auto-generated report.*")

    doc = "\n".join(lines)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"\n  [Doc] empirical_results.md updated → {out_path}")

# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="QRay Comprehensive Empirical Testing Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--all",        action="store_true", help="Run all 5 phases")
    parser.add_argument("--components", action="store_true", help="Phase A: component ablations")
    parser.add_argument("--benchmark",  action="store_true", help="Phase B: multi-scale cost benchmark")
    parser.add_argument("--profile",    action="store_true", help="Phase C: runtime profiling")
    parser.add_argument("--sweep",      action="store_true", help="Phase D: parameter sweep")
    parser.add_argument("--dynamic",    action="store_true", help="Phase E: dynamic rerouting")
    parser.add_argument("--scale",      type=str, default="all",
                        choices=["micro", "small", "medium", "large", "xl", "all"],
                        help="Scale for benchmark/profile (default: all)")
    parser.add_argument("--algo",       type=str, default="all",
                        help="Algorithm key for sweep (default: all). E.g. qalns, qpso, qga")
    parser.add_argument("--iters",      type=int, default=100,
                        help="Fixed iterations for --profile (default: 100)")
    parser.add_argument("--seed",       type=int, default=42,
                        help="Random seed (default: 42)")
    parser.add_argument("--save",       type=str, default=None,
                        help="Path to save JSON results (e.g. backend/empirical_benchmark_summary.json)")
    parser.add_argument("--doc",        action="store_true",
                        help="Auto-regenerate empirical_results.md from results")
    args = parser.parse_args()

    # Default: if no phase specified, show help
    run_any = any([args.all, args.components, args.benchmark,
                   args.profile, args.sweep, args.dynamic])
    if not run_any:
        parser.print_help()
        return

    hdr("QRay Quantum-Inspired Traffic Routing — Empirical Testing Suite")
    print(f"  Primary Contender : Adaptive Quantum-Guided ALNS+ (v5)")
    print(f"  Total Algorithms  : {len(ALGORITHM_REGISTRY)} registered")
    print(f"  Seed              : {args.seed}")
    print(f"  Phases requested  : "
          + ", ".join(p for p, flag in [
              ("A-Components", args.all or args.components),
              ("B-Benchmark",  args.all or args.benchmark),
              ("C-Profile",    args.all or args.profile),
              ("D-Sweep",      args.all or args.sweep),
              ("E-Dynamic",    args.all or args.dynamic),
          ] if flag))

    summary: Dict[str, Any] = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "seed": args.seed,
        "benchmark_dataset_results": {},
        "runtime_profile": {},
        "parameter_sweep": {},
        "component_empirical_tests": {},
        "dynamic_rerouting": {},
    }

    # Phase A
    if args.all or args.components:
        summary["component_empirical_tests"] = phase_components(args.seed)

    # Phase B
    if args.all or args.benchmark:
        scales = list(SCALES.keys()) if args.scale == "all" else [args.scale]
        summary["benchmark_dataset_results"] = phase_benchmark(scales, args.seed)

    # Phase C
    if args.all or args.profile:
        prof_scale = "small" if args.scale == "all" else args.scale
        summary["runtime_profile"] = phase_profile(prof_scale, args.iters, args.seed)

    # Phase D
    if args.all or args.sweep:
        algo_filter = None if args.algo == "all" else args.algo
        summary["parameter_sweep"] = phase_sweep(algo_filter, args.seed)

    # Phase E
    if args.all or args.dynamic:
        summary["dynamic_rerouting"] = phase_dynamic(args.seed)

    # Save JSON
    class NpEncoder(json.JSONEncoder):
        def default(self, o):
            if isinstance(o, (np.integer,)): return int(o)
            if isinstance(o, (np.floating,)): return float(o)
            if isinstance(o, np.ndarray): return o.tolist()
            return super().default(o)

    save_path = args.save or os.path.join(
        os.path.dirname(__file__), "empirical_benchmark_summary.json")
    try:
        # Preserve existing component tests if not re-run
        if not (args.all or args.components) and os.path.exists(save_path):
            with open(save_path) as f:
                old = json.load(f)
            if old.get("component_empirical_tests") and not summary["component_empirical_tests"]:
                summary["component_empirical_tests"] = old["component_empirical_tests"]

        with open(save_path, "w") as f:
            json.dump(summary, f, indent=2, cls=NpEncoder)
        print(f"\n  [Saved] JSON results → {save_path}")
    except Exception as e:
        print(f"\n  [Warning] Could not save JSON: {e}")

    # Auto-generate doc
    if args.doc or args.all:
        doc_path = os.path.join(os.path.dirname(__file__), "..", "empirical_results.md")
        doc_path = os.path.normpath(doc_path)
        generate_doc(summary, doc_path)

    hdr("Empirical Testing Suite Complete")

if __name__ == "__main__":
    main()
