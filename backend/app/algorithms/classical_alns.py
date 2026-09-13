"""
QRay Classical ALNS Control (Appendix A.7)
===========================================
Classical control baseline for ALNS:
- Uses the same destroy/repair scaffold as QALNS
- Uniform random destroy
- Greedy insertion repair
- Classical Boltzmann simulated annealing acceptance:
  P(accept | Delta) = exp(-Delta / T)
  where T(t) = T_0 * (1 - t/T)^2
Used to isolate whether quantum tunneling and quantum variance provide statistical advantage.
"""

import time
import math
import copy
import random
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost,
    build_greedy_starting_solution,
    quick_two_opt_polish
)

class ClassicalALNSSolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        destroy_fraction: float = 0.15,
        temp_factor: float = 0.08,
        time_budget_sec: float = 0.5,
        max_iterations: Optional[int] = None,
        seed: int = 42
    ):
        self.matrix = matrix
        self.demands = demands
        self.capacity = vehicle_capacity
        self.num_stops = num_stops
        self.num_vehicles = num_vehicles
        self.destroy_fraction = destroy_fraction
        self.temp_factor = temp_factor
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        random.seed(seed)
        np.random.seed(seed)

    def _eval(self, routes: List[List[int]]) -> Tuple[float, float, float, bool]:
        return fast_calculate_total_cost(
            routes=routes,
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            max_vehicles=self.num_vehicles
        )

    def _random_destroy(self, solution: List[List[int]], k: int) -> Tuple[List[int], List[List[int]]]:
        all_stops = [s for route in solution for s in route if s != 0]
        if not all_stops:
            return [], copy.deepcopy(solution)
        k = min(k, len(all_stops))
        removed = random.sample(all_stops, k)
        rem_set = set(removed)

        remaining = []
        for route in solution:
            filtered = [0] + [s for s in route if s != 0 and s not in rem_set] + [0]
            remaining.append(filtered)
        return removed, remaining

    def _greedy_repair(self, removed_stops: List[int], partial_solution: List[List[int]]) -> List[List[int]]:
        solution = copy.deepcopy(partial_solution)
        cleaned = []
        for r in solution:
            stops = [s for s in r if s != 0]
            cleaned.append([0] + stops + [0])
        solution = cleaned

        shuffled = list(removed_stops)
        random.shuffle(shuffled)
        route_loads = [sum(self.demands.get(s, 0.0) for s in r if s != 0) for r in solution]

        for stop in shuffled:
            demand = self.demands.get(stop, 0.0)
            best_cost_inc = float('inf')
            best_r_idx = -1
            best_pos = -1

            for r_idx, route in enumerate(solution):
                if route_loads[r_idx] + demand > self.capacity:
                    continue

                for pos in range(1, len(route)):
                    prev_node = route[pos - 1]
                    next_node = route[pos]
                    cost_inc = (
                        self.matrix[prev_node, stop] +
                        self.matrix[stop, next_node] -
                        self.matrix[prev_node, next_node]
                    )
                    if cost_inc < best_cost_inc:
                        best_cost_inc = cost_inc
                        best_r_idx = r_idx
                        best_pos = pos

            if best_r_idx != -1 and best_pos != -1:
                solution[best_r_idx].insert(best_pos, stop)
                route_loads[best_r_idx] += demand
            else:
                solution.append([0, stop, 0])
                route_loads.append(demand)

        return solution

    def solve(self) -> AlgorithmResult:
        random.seed(self.seed)
        np.random.seed(self.seed)
        start_time = time.perf_counter()

        current_solution = build_greedy_starting_solution(
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            num_vehicles=self.num_vehicles
        )
        current_solution = quick_two_opt_polish(current_solution, self.matrix)
        current_cost, pure_time, penalties, is_feasible = self._eval(current_solution)

        best_solution = copy.deepcopy(current_solution)
        best_cost = current_cost
        best_pure = pure_time
        best_feas = is_feasible

        T_0 = current_cost * self.temp_factor
        k_remove = max(2, int(round(self.destroy_fraction * self.num_stops)))
        iteration = 0

        accepted_improvements = 0
        accepted_boltzmann = 0
        rejected_moves = 0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
                elapsed_frac = min(1.0, iteration / max(1, self.max_iterations))
            else:
                if elapsed >= self.time_budget_sec:
                    break
                elapsed_frac = min(1.0, elapsed / self.time_budget_sec)

            temp = T_0 * (max(0.001, 1.0 - elapsed_frac) ** 2)

            removed, partial = self._random_destroy(current_solution, k_remove)
            new_solution = self._greedy_repair(removed, partial)
            new_cost, new_pure, _, new_feas = self._eval(new_solution)

            delta = new_cost - current_cost

            if delta < -1e-6:
                current_solution = new_solution
                current_cost = new_cost
                accepted_improvements += 1
            else:
                # Classical Boltzmann simulated annealing acceptance
                p_accept = math.exp(-delta / max(1e-6, temp))
                if random.random() < p_accept:
                    current_solution = new_solution
                    current_cost = new_cost
                    accepted_boltzmann += 1
                else:
                    rejected_moves += 1

            if current_cost < best_cost - 1e-6:
                best_solution = copy.deepcopy(current_solution)
                best_cost = current_cost
                best_pure = new_pure
                best_feas = new_feas

            iteration += 1

            # Periodic 2-opt
            if iteration % 30 == 0:
                best_solution = quick_two_opt_polish(best_solution, self.matrix)
                best_cost, best_pure, _, best_feas = self._eval(best_solution)
                current_solution = copy.deepcopy(best_solution)
                current_cost = best_cost

        best_solution = quick_two_opt_polish(best_solution, self.matrix)
        best_cost, best_pure, _, best_feas = self._eval(best_solution)

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Classical ALNS (Boltzmann SA Control)",
            category="Classical Baseline",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_solution,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "accepted_improvements": accepted_improvements,
                "accepted_boltzmann": accepted_boltzmann,
                "rejected_moves": rejected_moves,
                "k_remove": k_remove
            },
            metadata={"destroy_fraction": self.destroy_fraction, "temp_factor": self.temp_factor}
        )

def run_classical_alns(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = ClassicalALNSSolver(
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
