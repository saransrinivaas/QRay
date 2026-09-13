"""
QRay QPSO with Chaos / Logistic Map Mutation (Appendix A.2)
============================================================
Extension of QPSO that injects chaotic perturbation:
- Uses Logistic Map: x_{k+1} = 4 * x_k * (1 - x_k)
- Triggered when search stagnates for N consecutive iterations
- Perturbs worst 50% of swarm while preserving global and personal bests
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost,
    build_greedy_starting_solution,
    quick_two_opt_polish
)
from app.algorithms.qpso import decode_keys_to_routes, encode_routes_to_keys

class LogisticChaosGenerator:
    def __init__(self, seed: float = 0.618):
        self.x = seed

    def next_value(self) -> float:
        self.x = 4.0 * self.x * (1.0 - self.x)
        if self.x <= 0.001 or self.x >= 0.999:
            self.x = 0.54321
        return self.x

    def fill_array(self, shape: Tuple[int, ...]) -> np.ndarray:
        size = int(np.prod(shape))
        vals = np.zeros(size, dtype=np.float64)
        for i in range(size):
            vals[i] = self.next_value()
        return vals.reshape(shape)


class QPSOChaosSolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        swarm_size: int = 30,
        alpha: float = 0.7,
        stagnant_threshold: int = 10,
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
        self.alpha = alpha
        self.stagnant_threshold = stagnant_threshold
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        np.random.seed(seed)
        self.chaos_gen = LogisticChaosGenerator(seed=0.618)

    def _eval(self, keys: np.ndarray) -> Tuple[float, float, float, List[List[int]], bool]:
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

        greedy_routes = build_greedy_starting_solution(
            matrix=self.matrix,
            demands=self.demands,
            vehicle_capacity=self.capacity,
            num_stops=self.num_stops,
            num_vehicles=self.num_vehicles
        )
        seed_keys = encode_routes_to_keys(greedy_routes, dim)

        particles = np.random.uniform(0.0, 1.0, (self.swarm_size, dim))
        particles[0] = np.clip(seed_keys, 0.0, 1.0)
        for i in range(1, int(self.swarm_size * 0.75)):
            particles[i] = np.clip(seed_keys + np.random.normal(0.0, 0.12, dim), 0.0, 1.0)

        pbest_positions = np.copy(particles)
        pbest_costs = np.full(self.swarm_size, float('inf'))
        pbest_pure = np.zeros(self.swarm_size)
        pbest_routes = [[] for _ in range(self.swarm_size)]

        gbest_cost = float('inf')
        gbest_pure = float('inf')
        gbest_position = np.zeros(dim)
        gbest_routes = []
        gbest_feasible = False

        for i in range(self.swarm_size):
            cost, pure, pen, routes, feas = self._eval(particles[i])
            pbest_costs[i] = cost
            pbest_pure[i] = pure
            pbest_routes[i] = routes
            if cost < gbest_cost:
                gbest_cost = cost
                gbest_pure = pure
                gbest_position = np.copy(particles[i])
                gbest_routes = routes
                gbest_feasible = feas

        iteration = 0
        stagnant_count = 0
        chaos_triggers = 0
        t_chaos = 0.0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            mbest = np.mean(pbest_positions, axis=0)
            phi = np.random.uniform(0.0, 1.0, (self.swarm_size, dim))
            u = np.random.uniform(1e-10, 1.0, (self.swarm_size, dim))
            sign = np.random.choice([-1.0, 1.0], size=(self.swarm_size, dim))
            attractor = phi * pbest_positions + (1.0 - phi) * gbest_position

            mbest_diff = np.abs(mbest - particles)
            step = sign * self.alpha * mbest_diff * np.log(1.0 / u)
            particles = np.clip(attractor + step, 0.0, 1.0)

            # Chaos trigger check
            if stagnant_count >= self.stagnant_threshold:
                t0_c = time.perf_counter()
                chaos_triggers += 1
                sorted_by_cost = np.argsort(pbest_costs)
                worst_indices = sorted_by_cost[self.swarm_size // 2:]
                chaos_matrix = self.chaos_gen.fill_array((len(worst_indices), dim))

                for idx_pos, p_idx in enumerate(worst_indices):
                    gauss = np.random.normal(0.0, 0.1, dim)
                    particles[p_idx] = 0.7 * particles[p_idx] + 0.2 * chaos_matrix[idx_pos] + 0.1 * gauss
                    particles[p_idx] = np.clip(particles[p_idx], 0.0, 1.0)
                stagnant_count = 0
                t_chaos += (time.perf_counter() - t0_c)

            improved_any = False
            for i in range(self.swarm_size):
                cost, pure, pen, routes, feas = self._eval(particles[i])
                if cost < pbest_costs[i]:
                    pbest_costs[i] = cost
                    pbest_positions[i] = np.copy(particles[i])
                    pbest_pure[i] = pure
                    pbest_routes[i] = routes

                if cost < gbest_cost - 1e-6:
                    gbest_cost = cost
                    gbest_pure = pure
                    gbest_position = np.copy(particles[i])
                    gbest_routes = routes
                    gbest_feasible = feas
                    improved_any = True

            if improved_any:
                stagnant_count = 0
            else:
                stagnant_count += 1

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="QPSO + Chaos/Mutation",
            category="Quantum-Inspired",
            best_cost=gbest_cost,
            pure_travel_time=gbest_pure,
            penalties=max(0.0, gbest_cost - gbest_pure),
            best_routes=gbest_routes,
            elapsed_sec=total_elapsed,
            is_feasible=gbest_feasible,
            iterations=iteration,
            component_metrics={
                "chaos_triggers": chaos_triggers,
                "chaos_time_ms": round(t_chaos * 1000.0, 2),
                "stagnant_threshold": self.stagnant_threshold
            },
            metadata={"swarm_size": self.swarm_size, "alpha": self.alpha}
        )

def run_qpso_chaos(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = QPSOChaosSolver(
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
