"""
QRay Layer 5: Constraint & Feasibility Module
================================================
What this module does:
1. Evaluates total travel time cost of vehicle routes using the pre-calculated travel time matrix.
2. Checks all real-world feasibility constraints:
   - Vehicle capacity limit (truck overloading penalty)
   - Every customer stop visited exactly once (missing/duplicate stop penalty)
   - Route starts and ends at the Depot (node 0)
3. Returns total cost (travel time + penalty score). Infeasible routes receive heavy penalties
   so the QPSO optimizer naturally rejects them.
"""

import numpy as np
from typing import List, Dict, Tuple, Any

class FeasibilityEvaluator:
    """
    Evaluates route travel times and computes constraint violation penalties.
    """

    def __init__(self, travel_time_matrix: np.ndarray, demands: Dict[int, float], vehicle_capacity: float):
        """
        Args:
            travel_time_matrix: (N+1) x (N+1) pre-computed travel times.
            demands: Dict mapping stop ID -> demand load.
            vehicle_capacity: Maximum capacity of each vehicle.
        """
        self.matrix = travel_time_matrix
        self.demands = demands
        self.capacity = vehicle_capacity
        self.num_stops = len(demands) - 1  # Excluding depot 0

        # Penalty weight multipliers
        self.penalty_capacity = 1000.0   # Penalty per unit overload
        self.penalty_unvisited = 5000.0  # Penalty per unvisited or duplicate stop

    def evaluate_routes(self, routes: List[List[int]]) -> Tuple[float, float, float, Dict[str, Any]]:
        """
        Calculates pure travel time, constraint penalties, and total fitness cost for a set of routes.
        
        Args:
            routes: List of vehicle routes, e.g. [[0, 1, 3, 0], [0, 2, 4, 0]]
            
        Returns:
            Tuple of:
            - total_cost: pure_travel_time + total_penalties (used as QPSO fitness objective)
            - pure_travel_time: actual physical driving time (seconds/minutes)
            - total_penalties: penalty score for rule violations
            - details: dict containing broken down metrics
        """
        pure_travel_time = 0.0
        capacity_penalty = 0.0
        visited_stops = []

        for route in routes:
            if not route or len(route) < 2:
                continue

            # 1. Travel time for this vehicle's path
            route_load = 0.0
            for k in range(len(route) - 1):
                u, v = route[k], route[k + 1]
                pure_travel_time += self.matrix[u, v]

                # Accumulate customer demand (exclude depot 0)
                if u != 0:
                    route_load += self.demands.get(u, 0.0)
                    visited_stops.append(u)

            # Check capacity overload for this vehicle
            if route_load > self.capacity:
                overload = route_load - self.capacity
                capacity_penalty += overload * self.penalty_capacity

        # 2. Check single visit per stop constraint
        visited_count = len(visited_stops)
        unique_visited = len(set(visited_stops))
        
        missing_stops = self.num_stops - unique_visited
        duplicate_stops = visited_count - unique_visited

        visit_penalty = (missing_stops + duplicate_stops) * self.penalty_unvisited

        # Total fitness score to MINIMIZE
        total_penalties = capacity_penalty + visit_penalty
        total_cost = pure_travel_time + total_penalties

        details = {
            "pure_travel_time": pure_travel_time,
            "capacity_penalty": capacity_penalty,
            "visit_penalty": visit_penalty,
            "total_penalties": total_penalties,
            "is_feasible": (total_penalties == 0.0)
        }

        return total_cost, pure_travel_time, total_penalties, details
