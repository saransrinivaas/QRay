"""
QRay Common Algorithms Base Module
====================================
Shared data structures, vectorized cost calculators, and routing primitives
used across all quantum and classical algorithms.
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Any, Optional

@dataclass
class AlgorithmResult:
    algorithm_name: str
    category: str  # "Quantum-Inspired" or "Classical Baseline" or "Industry Benchmark"
    best_cost: float
    pure_travel_time: float
    penalties: float
    best_routes: List[List[int]]
    elapsed_sec: float
    is_feasible: bool
    iterations: int
    time_to_best_sec: float = 0.0
    iters_per_sec: float = 0.0
    component_metrics: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        def _sanitize(val):
            if isinstance(val, (np.integer, np.int64, np.int32)):
                return int(val)
            if isinstance(val, (np.floating, np.float64, np.float32)):
                return float(val)
            if isinstance(val, np.ndarray):
                return [_sanitize(x) for x in val.tolist()]
            if isinstance(val, list):
                return [_sanitize(x) for x in val]
            if isinstance(val, dict):
                return {k: _sanitize(v) for k, v in val.items()}
            return val

        return {
            "algorithm_name": str(self.algorithm_name),
            "category": str(self.category),
            "best_cost": round(float(self.best_cost), 2),
            "pure_travel_time": round(float(self.pure_travel_time), 2),
            "penalties": round(float(self.penalties), 2),
            "elapsed_sec": round(float(self.elapsed_sec), 4),
            "latency_ms": round(float(self.elapsed_sec) * 1000.0, 2),
            "time_to_best_ms": round(float(self.time_to_best_sec) * 1000.0, 2),
            "iters_per_sec": round(float(self.iters_per_sec), 1),
            "is_feasible": bool(self.is_feasible),
            "iterations": int(self.iterations),
            "component_metrics": _sanitize(self.component_metrics),
            "metadata": _sanitize(self.metadata),
            "routes": _sanitize(self.best_routes)
        }


def fast_calculate_total_cost(
    routes: List[List[int]],
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    max_vehicles: int,
    penalty_capacity: float = 1000.0,
    penalty_unvisited: float = 5000.0,
    penalty_vehicle_overflow: float = 2000.0
) -> Tuple[float, float, float, bool]:
    """
    Vectorized cost calculation (Layer 5 - Section 5.3):
    Calculates total travel time using flat array indexing when possible,
    plus constraint violation penalties.
    """
    pure_travel_time = 0.0
    capacity_penalty = 0.0
    visited_stops = []
    active_routes = 0

    for route in routes:
        if not route or len(route) < 2:
            continue
        
        # Clean route (strip excessive 0s if any, but maintain start/end 0)
        core = [node for node in route if node != 0]
        if not core:
            continue

        active_routes += 1
        full_route = [0] + core + [0]
        arr = np.array(full_route, dtype=np.int32)
        
        # Vectorized travel time lookup across consecutive stops
        pure_travel_time += float(np.sum(matrix[arr[:-1], arr[1:]]))

        # Check vehicle capacity load
        load = sum(demands.get(node, 0.0) for node in core)
        if load > vehicle_capacity:
            capacity_penalty += (load - vehicle_capacity) * penalty_capacity
        
        visited_stops.extend(core)

    # Check unvisited / duplicate stops
    unique_visited = set(visited_stops)
    missing = num_stops - len(unique_visited)
    duplicates = len(visited_stops) - len(unique_visited)
    visit_penalty = (missing + duplicates) * penalty_unvisited

    # Fleet limit penalty
    vehicle_penalty = 0.0
    if active_routes > max_vehicles:
        vehicle_penalty = (active_routes - max_vehicles) * penalty_vehicle_overflow

    total_penalties = capacity_penalty + visit_penalty + vehicle_penalty
    total_cost = pure_travel_time + total_penalties
    is_feasible = (total_penalties == 0.0)

    return total_cost, pure_travel_time, total_penalties, is_feasible


def build_greedy_starting_solution(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int
) -> List[List[int]]:
    """
    Constructs the canonical Greedy Nearest-Neighbor starting solution (Section 3.3).
    Guarantees that search begins from a sensible spatial arrangement and utilizes
    all configured vehicles when sufficient stops exist.
    """
    unvisited = set(range(1, num_stops + 1))
    routes = []

    for v_idx in range(num_vehicles):
        if not unvisited:
            break

        route = [0]
        current_node = 0
        current_load = 0.0

        # Reserve at least 1 stop for each remaining vehicle if available
        rem_v = num_vehicles - 1 - v_idx
        max_stops_this_veh = max(1, len(unvisited) - rem_v)

        while unvisited and (len(route) - 1) < max_stops_this_veh:
            candidates = [s for s in unvisited if current_load + demands.get(s, 0.0) <= vehicle_capacity]
            if not candidates:
                break
            
            # Select nearest candidate to current node
            best_cand = min(candidates, key=lambda s: matrix[current_node, s])
            route.append(best_cand)
            current_load += demands.get(best_cand, 0.0)
            current_node = best_cand
            unvisited.remove(best_cand)

        route.append(0)
        routes.append(route)

    # If any stops remain due to vehicle capacity exhaustion, allocate to multiple trips / extra routes
    while unvisited:
        route = [0]
        current_load = 0.0
        current_node = 0
        while unvisited:
            candidates = [s for s in unvisited if current_load + demands.get(s, 0.0) <= vehicle_capacity]
            if not candidates:
                if len(route) == 1:
                    # Even empty vehicle can't fit stop, force pick one to avoid infinite loop
                    forced = unvisited.pop()
                    route.append(forced)
                break
            best_cand = min(candidates, key=lambda s: matrix[current_node, s])
            route.append(best_cand)
            current_load += demands.get(best_cand, 0.0)
            current_node = best_cand
            unvisited.remove(best_cand)
        route.append(0)
        routes.append(route)

    return routes


def quick_two_opt_polish(routes: List[List[int]], matrix: np.ndarray) -> List[List[int]]:
    """
    Executes one fast pass of 2-opt edge swap on each route (Section 3.7).
    Uncrosses obvious path overlaps without running to full convergence.
    """
    polished_routes = []
    for r in routes:
        route = list(r)
        if len(route) < 5:  # Need at least [0, A, B, C, 0] to swap
            polished_routes.append(route)
            continue

        n = len(route)
        for i in range(1, n - 2):
            for j in range(i + 1, n - 1):
                old_cost = matrix[route[i - 1], route[i]] + matrix[route[j], route[j + 1]]
                new_cost = matrix[route[i - 1], route[j]] + matrix[route[i], route[j + 1]]
                if new_cost < old_cost - 1e-6:
                    route[i:j + 1] = reversed(route[i:j + 1])
        polished_routes.append(route)
    return polished_routes
