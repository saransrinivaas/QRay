"""
QRay Clarke-Wright Savings Heuristic Baseline
===============================================
Classic CVRP heuristic:
Calculates savings S(i, j) = d(0, i) + d(0, j) - d(i, j)
and iteratively merges routes while respecting vehicle capacities.
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost
)

def run_clarke_wright(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    **kwargs
) -> AlgorithmResult:
    start_time = time.perf_counter()

    # Calculate savings S(i, j) = matrix[0, i] + matrix[0, j] - matrix[i, j]
    savings = []
    for i in range(1, num_stops + 1):
        for j in range(i + 1, num_stops + 1):
            s = matrix[0, i] + matrix[0, j] - matrix[i, j]
            savings.append((s, i, j))

    # Sort descending
    savings.sort(key=lambda x: x[0], reverse=True)

    # Initial routes: 1 route per customer [0, i, 0]
    routes_map = {i: [0, i, 0] for i in range(1, num_stops + 1)}

    for s, i, j in savings:
        if i not in routes_map or j not in routes_map:
            continue
        r_i = routes_map[i]
        r_j = routes_map[j]

        if r_i == r_j:
            continue

        # Check if i is end of r_i and j is start of r_j
        if r_i[-2] == i and r_j[1] == j:
            load_i = sum(demands.get(node, 0.0) for node in r_i if node != 0)
            load_j = sum(demands.get(node, 0.0) for node in r_j if node != 0)
            if load_i + load_j <= vehicle_capacity:
                merged = r_i[:-1] + r_j[1:]
                for node in merged:
                    if node != 0:
                        routes_map[node] = merged

    unique_routes = []
    seen = set()
    for r in routes_map.values():
        t = tuple(r)
        if t not in seen:
            seen.add(t)
            unique_routes.append(list(r))

    while len(unique_routes) < num_vehicles:
        unique_routes.append([0, 0])

    elapsed_sec = time.perf_counter() - start_time
    total_cost, pure_time, penalties, is_feasible = fast_calculate_total_cost(
        routes=unique_routes,
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        max_vehicles=num_vehicles
    )

    return AlgorithmResult(
        algorithm_name="Clarke-Wright Savings",
        category="Classical Baseline",
        best_cost=total_cost,
        pure_travel_time=pure_time,
        penalties=penalties,
        best_routes=unique_routes,
        elapsed_sec=elapsed_sec,
        is_feasible=is_feasible,
        iterations=1,
        component_metrics={"savings_pairs": len(savings)},
        metadata={"merged_routes": len(unique_routes)}
    )
