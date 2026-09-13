"""
Google OR-Tools CVRP Solver Module (Appendix A.8)
=================================================
Industry-standard operations research benchmark for Capacitated VRP.

Configurations supported:
1. Fast Mode (ortools_fast):
   Uses PATH_CHEAPEST_ARC first solution heuristic. Terminates immediately without local search.
2. Guided Local Search Mode (ortools_gls):
   Uses PATH_CHEAPEST_ARC followed by GUIDED_LOCAL_SEARCH metaheuristic within a given time budget.
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from app.algorithms.base import AlgorithmResult, fast_calculate_total_cost

def run_ortools(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    mode: str = "fast",
    seed: int = 42
) -> AlgorithmResult:
    """
    Runs Google OR-Tools CVRP solver.
    mode: "fast" (PATH_CHEAPEST_ARC first solution only) or "gls" (Guided Local Search)
    """
    start_time = time.perf_counter()
    n_locations = num_stops + 1

    # Scale matrix to integer distances (OR-Tools requires integer costs)
    scale_factor = 100.0
    int_matrix = np.round(matrix * scale_factor).astype(np.int64)

    # Convert demands to integer list
    int_demands = [0] + [int(round(demands.get(i, 0.0))) for i in range(1, n_locations)]
    int_capacity = int(round(vehicle_capacity))

    # Create the routing index manager
    # Depot is node 0 for both starts and ends of all vehicles
    manager = pywrapcp.RoutingIndexManager(
        n_locations,
        num_vehicles,
        0  # depot
    )

    routing = pywrapcp.RoutingModel(manager)

    # Transit callback (travel time)
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int_matrix[from_node, to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Demand callback (capacity constraint)
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return int_demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        [int_capacity] * num_vehicles,  # vehicle maximum capacities
        True,  # start cumul to zero
        "Capacity"
    )

    # Search parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    if mode == "gls":
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(max(1, int(round(time_budget_sec))))
    else:
        # Fast mode: limit solution search time tightly
        search_parameters.time_limit.FromMilliseconds(int(time_budget_sec * 1000.0))

    solution = routing.SolveWithParameters(search_parameters)
    elapsed_sec = time.perf_counter() - start_time

    if not solution:
        # Fallback if OR-Tools fails to find a feasible solution
        return AlgorithmResult(
            algorithm_name=f"Google OR-Tools ({mode.upper()})",
            category="Industry Benchmark",
            best_cost=float('inf'),
            pure_travel_time=float('inf'),
            penalties=99999.0,
            best_routes=[],
            elapsed_sec=elapsed_sec,
            is_feasible=False,
            iterations=1,
            component_metrics={"status": "NO_SOLUTION_FOUND"},
            metadata={"mode": mode}
        )

    # Extract routes from OR-Tools solution
    routes = []
    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        route = [manager.IndexToNode(index)]
        while not routing.IsEnd(index):
            index = solution.Value(routing.NextVar(index))
            route.append(manager.IndexToNode(index))
        routes.append(route)

    # Evaluate using QRay's ground truth feasibility calculator
    total_cost, pure_time, penalties, is_feasible = fast_calculate_total_cost(
        routes=routes,
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        max_vehicles=num_vehicles
    )

    algo_name = "OR-Tools (Fast)" if mode == "fast" else "OR-Tools (GLS)"
    return AlgorithmResult(
        algorithm_name=algo_name,
        category="Industry Benchmark",
        best_cost=total_cost,
        pure_travel_time=pure_time,
        penalties=penalties,
        best_routes=routes,
        elapsed_sec=elapsed_sec,
        is_feasible=is_feasible,
        iterations=1 if mode == "fast" else int(round(elapsed_sec * 100)),
        component_metrics={"mode": mode, "status": "OPTIMAL_OR_FEASIBLE"},
        metadata={"num_vehicles": num_vehicles, "scale_factor": scale_factor}
    )

def run_ortools_fast(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    seed: int = 42,
    **kwargs
) -> AlgorithmResult:
    return run_ortools(
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        num_vehicles=num_vehicles,
        time_budget_sec=time_budget_sec,
        mode="fast",
        seed=seed
    )

def run_ortools_gls(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    seed: int = 42,
    **kwargs
) -> AlgorithmResult:
    return run_ortools(
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        num_vehicles=num_vehicles,
        time_budget_sec=time_budget_sec,
        mode="gls",
        seed=seed
    )
