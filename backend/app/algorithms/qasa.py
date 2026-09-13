"""
QRay Quantum-Annealing-Inspired Local Search (QASA) (Appendix A.5)
===================================================================
Implementation based on Appendix A.5.

Mechanism:
- Initialized with Greedy Nearest-Neighbor + initial 2-opt polish.
- Generates continuous random local search moves:
  * 2-Opt intra-route segment reversals
  * Or-Opt single-stop relocations (intra- and inter-route)
- Accepts moves using the decaying transverse-field quantum tunneling formula:
  P(accept | Delta) = 1 / (1 + (Delta / Gamma)^2)
  where Gamma(t) = Gamma_0 * max(0.02, 1 - t/T)^2
- Ultra-low latency, high iteration throughput.
"""

import time
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

class QASASolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        gamma_factor: float = 0.05,
        time_budget_sec: float = 0.5,
        max_iterations: Optional[int] = None,
        seed: int = 42
    ):
        self.matrix = matrix
        self.demands = demands
        self.capacity = vehicle_capacity
        self.num_stops = num_stops
        self.num_vehicles = num_vehicles
        self.gamma_factor = gamma_factor
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

    def solve(self) -> AlgorithmResult:
        random.seed(self.seed)
        np.random.seed(self.seed)
        start_time = time.perf_counter()

        # Seed from Greedy Nearest-Neighbor + 2-opt
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

        gamma_0 = current_cost * self.gamma_factor
        iteration = 0

        two_opt_moves = 0
        or_opt_moves = 0
        accepted_improvements = 0
        accepted_tunneling = 0
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

            gamma = gamma_0 * (max(0.02, 1.0 - elapsed_frac) ** 2)

            candidate = copy.deepcopy(current_solution)

            # Pick move type: 50% 2-opt swap, 50% Or-opt relocate
            if random.random() < 0.5:
                # 2-Opt intra-route move
                two_opt_moves += 1
                non_empty = [r for r in candidate if len(r) >= 5]
                if non_empty:
                    route = random.choice(non_empty)
                    n = len(route)
                    i = random.randint(1, n - 3)
                    j = random.randint(i + 1, n - 2)
                    route[i:j + 1] = reversed(route[i:j + 1])
            else:
                # Or-Opt relocation move
                or_opt_moves += 1
                non_empty_indices = [idx for idx, r in enumerate(candidate) if len(r) > 2]
                if non_empty_indices:
                    src_r_idx = random.choice(non_empty_indices)
                    src_route = candidate[src_r_idx]
                    stop_idx = random.randint(1, len(src_route) - 2)
                    stop = src_route.pop(stop_idx)

                    dest_r_idx = random.randint(0, len(candidate) - 1)
                    dest_route = candidate[dest_r_idx]
                    ins_idx = random.randint(1, len(dest_route) - 1)
                    dest_route.insert(ins_idx, stop)

            new_cost, new_pure, new_pen, new_feas = self._eval(candidate)
            delta = new_cost - current_cost

            # Acceptance via quantum tunneling schedule
            if delta < -1e-6:
                current_solution = candidate
                current_cost = new_cost
                accepted_improvements += 1
            else:
                p_accept = 1.0 / (1.0 + ((delta / max(1e-6, gamma)) ** 2))
                if random.random() < p_accept:
                    current_solution = candidate
                    current_cost = new_cost
                    accepted_tunneling += 1
                else:
                    rejected_moves += 1

            if current_cost < best_cost - 1e-6:
                best_solution = copy.deepcopy(current_solution)
                best_cost = current_cost
                best_pure = new_pure
                best_feas = new_feas

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Quantum-Annealing Local Search (QASA)",
            category="Quantum-Inspired",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_solution,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "two_opt_moves": two_opt_moves,
                "or_opt_moves": or_opt_moves,
                "accepted_improvements": accepted_improvements,
                "accepted_tunneling": accepted_tunneling,
                "rejected_moves": rejected_moves
            },
            metadata={"gamma_factor": self.gamma_factor}
        )

def run_qasa(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = QASASolver(
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
