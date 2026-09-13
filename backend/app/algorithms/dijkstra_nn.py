"""
QRay Dijkstra / Greedy Nearest Neighbor Baseline
=================================================
Deterministic greedy nearest-neighbor route construction.
Serves as the foundational speed baseline and heuristic seed for metaheuristics.
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost,
    build_greedy_starting_solution
)

def run_dijkstra_nn(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    **kwargs
) -> AlgorithmResult:
    start_time = time.perf_counter()

    routes = build_greedy_starting_solution(
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        num_vehicles=num_vehicles
    )

    elapsed_sec = time.perf_counter() - start_time
    total_cost, pure_time, penalties, is_feasible = fast_calculate_total_cost(
        routes=routes,
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        max_vehicles=num_vehicles
    )

    return AlgorithmResult(
        algorithm_name="Dijkstra / Nearest Neighbor",
        category="Classical Baseline",
        best_cost=total_cost,
        pure_travel_time=pure_time,
        penalties=penalties,
        best_routes=routes,
        elapsed_sec=elapsed_sec,
        is_feasible=is_feasible,
        iterations=1,
        component_metrics={"construction_type": "Greedy Nearest Neighbor"},
        metadata={"num_vehicles_used": len([r for r in routes if len(r) > 2])}
    )
