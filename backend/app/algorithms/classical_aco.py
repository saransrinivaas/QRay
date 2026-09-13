"""
QRay Classical Ant Colony Optimization (ACO) Baseline
=======================================================
Standard Ant Colony Optimization with:
- Heuristic matrix eta = 1 / distance
- Classical linear pheromone matrix tau
- Linear evaporation (1 - rho) * tau
- Inverse-cost deposit on traversed paths
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost
)

class ClassicalACOSolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        num_ants: int = 15,
        evaporation_rate: float = 0.1,
        alpha: float = 1.0,
        beta: float = 2.0,
        time_budget_sec: float = 0.5,
        max_iterations: Optional[int] = None,
        seed: int = 42
    ):
        self.matrix = matrix
        self.demands = demands
        self.capacity = vehicle_capacity
        self.num_stops = num_stops
        self.num_vehicles = num_vehicles
        self.num_ants = num_ants
        self.evaporation_rate = evaporation_rate
        self.alpha = alpha
        self.beta = beta
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        np.random.seed(seed)

    def solve(self) -> AlgorithmResult:
        start_time = time.perf_counter()
        n = self.num_stops + 1

        eta = np.zeros((n, n), dtype=np.float64)
        for i in range(n):
            for j in range(n):
                if i != j and self.matrix[i, j] > 0:
                    eta[i, j] = 1.0 / self.matrix[i, j]

        tau = np.ones((n, n), dtype=np.float64) * 0.1

        best_cost = float('inf')
        best_pure = float('inf')
        best_routes = []
        best_feas = False

        iteration = 0
        ants_run = 0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            all_ant_routes = []
            all_ant_costs = []

            for _ in range(self.num_ants):
                unvisited = set(range(1, self.num_stops + 1))
                ant_routes = []

                for _ in range(self.num_vehicles):
                    if not unvisited:
                        ant_routes.append([0, 0])
                        continue

                    route = [0]
                    curr = 0
                    load = 0.0

                    while unvisited:
                        candidates = [c for c in unvisited if load + self.demands.get(c, 0.0) <= self.capacity]
                        if not candidates:
                            break

                        probs = [(tau[curr, c] ** self.alpha) * (eta[curr, c] ** self.beta) for c in candidates]
                        probs = np.array(probs, dtype=np.float64)
                        p_sum = np.sum(probs)
                        if p_sum <= 1e-12:
                            p_norm = np.ones(len(candidates)) / len(candidates)
                        else:
                            p_norm = probs / p_sum

                        nxt = np.random.choice(candidates, p=p_norm)
                        route.append(nxt)
                        load += self.demands.get(nxt, 0.0)
                        unvisited.remove(nxt)
                        curr = nxt

                    route.append(0)
                    ant_routes.append(route)

                while unvisited:
                    route = [0]
                    load = 0.0
                    while unvisited:
                        candidates = [c for c in unvisited if load + self.demands.get(c, 0.0) <= self.capacity]
                        if not candidates:
                            if len(route) == 1:
                                route.append(unvisited.pop())
                            break
                        nxt = min(candidates, key=lambda c: self.matrix[route[-1], c])
                        route.append(nxt)
                        load += self.demands.get(nxt, 0.0)
                        unvisited.remove(nxt)
                    route.append(0)
                    ant_routes.append(route)

                ants_run += 1
                cost, pure, pen, feas = fast_calculate_total_cost(
                    routes=ant_routes,
                    matrix=self.matrix,
                    demands=self.demands,
                    vehicle_capacity=self.capacity,
                    num_stops=self.num_stops,
                    max_vehicles=self.num_vehicles
                )
                all_ant_routes.append(ant_routes)
                all_ant_costs.append(cost)

                if cost < best_cost:
                    best_cost = cost
                    best_pure = pure
                    best_routes = ant_routes
                    best_feas = feas

            # Evaporate
            tau = (1.0 - self.evaporation_rate) * tau

            # Deposit pheromone
            for a in range(len(all_ant_routes)):
                c = all_ant_costs[a]
                if c > 0:
                    deposit = 1.0 / c
                    for r in all_ant_routes[a]:
                        for k in range(len(r) - 1):
                            u, v = r[k], r[k + 1]
                            tau[u, v] += deposit

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Classical Ant Colony Optimization (ACO)",
            category="Classical Baseline",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_routes,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "ants_run": ants_run,
                "evaporation_rate": self.evaporation_rate
            },
            metadata={"num_ants": self.num_ants}
        )

def run_classical_aco(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = ClassicalACOSolver(
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
