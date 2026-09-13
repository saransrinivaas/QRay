"""
QRay Quantum-Inspired Genetic Algorithm (QGA) (Appendix A.3)
==============================================================
Implementation based on Han & Kim (2002) and Appendix A.3.

Representation:
- Each individual is a vector of qubit rotation angles theta_i in [0, pi/2].
- Keys are measured in probability amplitude space: k_i = sin^2(theta_i).
- Han & Kim quantum rotation gate updates angles towards the best individual:
  theta_i <- theta_i + sign(theta_best - theta_i) * delta_theta
- Quantum NOT-gate / angle flip mutation for population diversity.
"""

import time
import math
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost,
    build_greedy_starting_solution
)
from app.algorithms.qpso import decode_keys_to_routes, encode_routes_to_keys

class QGASolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        pop_size: int = 30,
        delta_theta: float = 0.05 * math.pi,
        mutation_rate: float = 0.05,
        time_budget_sec: float = 0.5,
        max_iterations: Optional[int] = None,
        seed: int = 42
    ):
        self.matrix = matrix
        self.demands = demands
        self.capacity = vehicle_capacity
        self.num_stops = num_stops
        self.num_vehicles = num_vehicles
        self.pop_size = pop_size
        self.delta_theta = delta_theta
        self.mutation_rate = mutation_rate
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        np.random.seed(seed)

    def _eval(self, angles: np.ndarray) -> Tuple[float, float, float, List[List[int]], bool]:
        # Qubit state measurement: probability k_i = sin^2(theta_i)
        keys = np.sin(angles) ** 2
        routes = decode_keys_to_routes(
            keys=keys,
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            num_vehicles=self.num_vehicles
        )
        total_cost, pure_time, penalties, is_feasible = fast_calculate_total_cost(
            routes=routes,
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            max_vehicles=self.num_vehicles
        )
        return total_cost, pure_time, penalties, routes, is_feasible

    def solve(self) -> AlgorithmResult:
        start_time = time.perf_counter()
        dim = self.num_stops

        # Greedy seed
        greedy_routes = build_greedy_starting_solution(
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            num_vehicles=self.num_vehicles
        )
        seed_keys = encode_routes_to_keys(greedy_routes, dim)
        # Invert sin^2(theta) = key -> theta = arcsin(sqrt(key))
        seed_angles = np.arcsin(np.sqrt(np.clip(seed_keys, 1e-6, 1.0 - 1e-6)))

        # Initialize qubit angles in [0, pi/2]
        angles = np.random.uniform(0.0, 0.5 * math.pi, (self.pop_size, dim))
        angles[0] = seed_angles
        for i in range(1, int(self.pop_size * 0.7)):
            angles[i] = np.clip(seed_angles + np.random.normal(0.0, 0.1, dim), 0.0, 0.5 * math.pi)

        costs = np.zeros(self.pop_size)
        routes_list = [[] for _ in range(self.pop_size)]
        pures = np.zeros(self.pop_size)

        best_cost = float('inf')
        best_pure = float('inf')
        best_angles = np.zeros(dim)
        best_routes = []
        best_feas = False

        for i in range(self.pop_size):
            cost, pure, pen, routes, feas = self._eval(angles[i])
            costs[i] = cost
            routes_list[i] = routes
            pures[i] = pure
            if cost < best_cost:
                best_cost = cost
                best_pure = pure
                best_angles = np.copy(angles[i])
                best_routes = routes
                best_feas = feas

        iteration = 0
        rotations_performed = 0
        mutations_performed = 0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            # Han & Kim Quantum Rotation Gate update
            for i in range(self.pop_size):
                diff = best_angles - angles[i]
                direction = np.sign(diff)
                # Rotate toward best individual
                angles[i] += direction * self.delta_theta * (np.abs(diff) / (0.5 * math.pi))
                rotations_performed += 1

                # Quantum angle-flip mutation
                if np.random.rand() < self.mutation_rate:
                    mut_idx = np.random.randint(0, dim)
                    angles[i, mut_idx] = 0.5 * math.pi - angles[i, mut_idx]
                    mutations_performed += 1

                angles[i] = np.clip(angles[i], 0.0, 0.5 * math.pi)

                # Re-evaluate
                cost, pure, pen, routes, feas = self._eval(angles[i])
                costs[i] = cost
                if cost < best_cost - 1e-6:
                    best_cost = cost
                    best_pure = pure
                    best_angles = np.copy(angles[i])
                    best_routes = routes
                    best_feas = feas

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Quantum-Inspired Genetic Algorithm (QGA)",
            category="Quantum-Inspired",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_routes,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "rotations_performed": rotations_performed,
                "mutations_performed": mutations_performed,
                "delta_theta": self.delta_theta
            },
            metadata={"pop_size": self.pop_size, "mutation_rate": self.mutation_rate}
        )

def run_qga(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = QGASolver(
        matrix=matrix,
        demands=demands,
        vehicle_capacity=vehicle_capacity,
        num_stops=num_stops,
        num_vehicles=num_vehicles,
        time_budget_sec=time_budget_sec,
        max_iterations=max_iterations,
        seed=seed
    )
    return solver.solve()
