"""
QRay Classical Genetic Algorithm (GA) Baseline
================================================
Standard Genetic Algorithm with:
- Permutation chromosome representation
- Ordered Crossover (OX)
- Swap mutation
- Top-3 elitism
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost
)
from app.algorithms.qpso import decode_keys_to_routes

class ClassicalGASolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        pop_size: int = 50,
        crossover_rate: float = 0.85,
        mutation_rate: float = 0.15,
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
        self.crossover_rate = crossover_rate
        self.mutation_rate = mutation_rate
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        np.random.seed(seed)

    def _eval_perm(self, perm: np.ndarray) -> Tuple[float, float, float, List[List[int]], bool]:
        keys = np.zeros(self.num_stops, dtype=np.float64)
        for rank, stop_id in enumerate(perm):
            keys[stop_id - 1] = rank / max(1, self.num_stops)
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

        population = [np.random.permutation(np.arange(1, dim + 1)) for _ in range(self.pop_size)]

        best_cost = float('inf')
        best_pure = float('inf')
        best_routes = []
        best_feas = False

        iteration = 0
        crossovers_done = 0
        mutations_done = 0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            costs = []
            for ind in population:
                cost, pure, pen, routes, feas = self._eval_perm(ind)
                costs.append(cost)
                if cost < best_cost:
                    best_cost = cost
                    best_pure = pure
                    best_routes = routes
                    best_feas = feas

            sorted_indices = np.argsort(costs)
            elite_pop = [np.copy(population[idx]) for idx in sorted_indices[:3]]

            # Tournament selection
            new_pop = []
            for _ in range(self.pop_size - 3):
                t1, t2 = np.random.choice(self.pop_size, size=2, replace=False)
                winner = population[t1] if costs[t1] < costs[t2] else population[t2]
                new_pop.append(np.copy(winner))

            # Ordered Crossover (OX)
            for i in range(0, len(new_pop) - 1, 2):
                if np.random.rand() < self.crossover_rate and dim > 2:
                    p1, p2 = new_pop[i], new_pop[i + 1]
                    cut1, cut2 = sorted(np.random.choice(dim, size=2, replace=False))
                    c1 = -np.ones(dim, dtype=int)
                    c1[cut1:cut2] = p1[cut1:cut2]
                    fill_vals = [val for val in p2 if val not in c1]
                    idx = 0
                    for k in range(dim):
                        if c1[k] == -1:
                            c1[k] = fill_vals[idx]
                            idx += 1
                    new_pop[i] = c1
                    crossovers_done += 1

            # Swap mutation
            for i in range(len(new_pop)):
                if np.random.rand() < self.mutation_rate and dim > 1:
                    idx1, idx2 = np.random.choice(dim, size=2, replace=False)
                    new_pop[i][idx1], new_pop[i][idx2] = new_pop[i][idx2], new_pop[i][idx1]
                    mutations_done += 1

            population = elite_pop + new_pop
            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Classical Genetic Algorithm (GA)",
            category="Classical Baseline",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_routes,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "crossovers_done": crossovers_done,
                "mutations_done": mutations_done,
                "pop_size": self.pop_size
            },
            metadata={"crossover_rate": self.crossover_rate, "mutation_rate": self.mutation_rate}
        )

def run_classical_ga(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = ClassicalGASolver(
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
