"""
QRay Quantum Solution Swarm (QSS) (Appendix A.6)
==================================================
Implementation based on Appendix A.6.

Mechanism:
- Maintains a population of M complete candidate solutions.
- Each member's quality is mapped to a quantum-like probability amplitude via softmax.
- Amplitudes construct a global Edge-Consensus Table:
  C(u, v) = sum_{m=1}^M A_m * 1[(u, v) in solution_m]
- New solutions are assembled by preferring edges with high quantum agreement.
- Heavy computational cost per attempt due to whole-solution construction.
"""

import time
import copy
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost,
    build_greedy_starting_solution,
    quick_two_opt_polish
)

class QSSSolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        swarm_size: int = 10,
        consensus_bias: float = 2.0,
        time_budget_sec: float = 0.5,
        max_iterations: Optional[int] = None,
        seed: int = 42
    ):
        self.matrix = matrix
        self.demands = demands
        self.capacity = vehicle_capacity
        self.num_stops = num_stops
        self.num_vehicles = num_vehicles
        self.swarm_size = swarm_size
        self.consensus_bias = consensus_bias
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

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

    def _build_consensus_solution(self, consensus_table: np.ndarray) -> List[List[int]]:
        """Constructs a solution greedily guided by quantum consensus amplitudes."""
        unvisited = set(range(1, self.num_stops + 1))
        routes = []

        for _ in range(self.num_vehicles):
            if not unvisited:
                break
            route = [0]
            curr = 0
            load = 0.0

            while unvisited:
                candidates = [c for c in unvisited if load + self.demands.get(c, 0.0) <= self.capacity]
                if not candidates:
                    break

                # Combine consensus probability amplitude and inverse distance
                scores = []
                for c in candidates:
                    dist = max(self.matrix[curr, c], 1e-4)
                    consensus_score = (consensus_table[curr, c] + 0.05) ** self.consensus_bias
                    scores.append(consensus_score / dist)

                scores = np.array(scores, dtype=np.float64)
                s_sum = np.sum(scores)
                if s_sum <= 1e-12:
                    p = np.ones(len(candidates)) / len(candidates)
                else:
                    p = scores / s_sum

                chosen = np.random.choice(candidates, p=p)
                route.append(chosen)
                load += self.demands.get(chosen, 0.0)
                unvisited.remove(chosen)
                curr = chosen

            route.append(0)
            routes.append(route)

        while unvisited:
            route = [0]
            load = 0.0
            while unvisited:
                candidates = [c for c in unvisited if load + self.demands.get(c, 0.0) <= self.capacity]
                if not candidates:
                    if len(route) == 1:
                        route.append(unvisited.pop())
                    break
                chosen = min(candidates, key=lambda c: self.matrix[route[-1], c])
                route.append(chosen)
                load += self.demands.get(chosen, 0.0)
                unvisited.remove(chosen)
            route.append(0)
            routes.append(route)

        return routes

    def solve(self) -> AlgorithmResult:
        start_time = time.perf_counter()
        n = self.num_stops + 1

        # Seed member 0 from greedy nearest-neighbor
        greedy_seed = build_greedy_starting_solution(
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            num_vehicles=self.num_vehicles
        )

        population: List[List[List[int]]] = [copy.deepcopy(greedy_seed)]
        costs: List[float] = []
        pures: List[float] = []

        cost0, pure0, _, _ = self._eval(greedy_seed)
        costs.append(cost0)
        pures.append(pure0)

        best_cost = cost0
        best_pure = pure0
        best_routes = copy.deepcopy(greedy_seed)
        best_feas = True

        # Generate initial diversified population
        all_stops = list(range(1, self.num_stops + 1))
        for _ in range(self.swarm_size - 1):
            shuffled = list(all_stops)
            np.random.shuffle(shuffled)
            # Greedy chunking
            sol = []
            cur_r = [0]
            load = 0.0
            for s in shuffled:
                d = self.demands.get(s, 0.0)
                if load + d <= self.capacity:
                    cur_r.append(s)
                    load += d
                else:
                    cur_r.append(0)
                    sol.append(cur_r)
                    cur_r = [0, s]
                    load = d
            if len(cur_r) > 1:
                cur_r.append(0)
                sol.append(cur_r)
            while len(sol) < self.num_vehicles:
                sol.append([0, 0])

            c, p, _, f = self._eval(sol)
            population.append(sol)
            costs.append(c)
            pures.append(p)
            if c < best_cost:
                best_cost = c
                best_pure = p
                best_routes = sol
                best_feas = f

        iteration = 0
        reconstructions = 0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            # 1. Calculate softmax probability amplitudes for each solution
            cost_arr = np.array(costs)
            norm_costs = (cost_arr - np.min(cost_arr)) / (np.ptp(cost_arr) + 1e-6)
            # Higher amplitude for lower costs
            amplitudes = np.exp(-3.0 * norm_costs)
            amplitudes /= np.sum(amplitudes)

            # 2. Build quantum edge consensus table
            consensus = np.zeros((n, n), dtype=np.float64)
            for m_idx, sol in enumerate(population):
                amp = amplitudes[m_idx]
                for r in sol:
                    for k in range(len(r) - 1):
                        u, v = r[k], r[k + 1]
                        consensus[u, v] += amp

            # 3. Assemble new candidate solution via consensus
            new_cand = self._build_consensus_solution(consensus)
            new_cand = quick_two_opt_polish(new_cand, self.matrix)
            reconstructions += 1

            new_cost, new_pure, _, new_feas = self._eval(new_cand)

            # Replace worst member in population if better
            worst_idx = int(np.argmax(costs))
            if new_cost < costs[worst_idx]:
                population[worst_idx] = new_cand
                costs[worst_idx] = new_cost
                pures[worst_idx] = new_pure

            if new_cost < best_cost - 1e-6:
                best_cost = new_cost
                best_pure = new_pure
                best_routes = copy.deepcopy(new_cand)
                best_feas = new_feas

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Quantum Solution Swarm (QSS)",
            category="Quantum-Inspired",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_routes,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "reconstructions": reconstructions,
                "consensus_bias": self.consensus_bias,
                "swarm_size": self.swarm_size
            },
            metadata={"swarm_size": self.swarm_size}
        )

def run_qss(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = QSSSolver(
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
