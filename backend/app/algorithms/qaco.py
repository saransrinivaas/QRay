"""
QRay Quantum-Inspired Ant Colony Optimization (QACO) (Appendix A.4)
====================================================================
Implementation based on Appendix A.4.

Mechanism:
- Pheromone represented on each edge as a qubit amplitude q_ij in [0, 1].
- Effective probability pheromone intensity: tau_ij = q_ij^2.
- Ants construct routes probabilistically using tau_ij * eta_ij (heuristic eta = 1 / distance).
- Quantum rotation update rotates qubit amplitudes of best-found edges toward 1:
  q_ij <- q_ij + delta_rot * (1 - q_ij)
- Decay applied to unchosen edges.
"""

import time
import numpy as np
from typing import List, Dict, Tuple, Any, Optional

from app.algorithms.base import (
    AlgorithmResult,
    fast_calculate_total_cost
)

class QACOSolver:
    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        num_ants: int = 15,
        rotation_step: float = 0.08,
        decay_rate: float = 0.05,
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
        self.rotation_step = rotation_step
        self.decay_rate = decay_rate
        self.alpha = alpha
        self.beta = beta
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        np.random.seed(seed)

    def solve(self) -> AlgorithmResult:
        start_time = time.perf_counter()
        n = self.num_stops + 1

        # Heuristic matrix eta = 1 / distance
        eta = np.zeros((n, n), dtype=np.float64)
        for i in range(n):
            for j in range(n):
                if i != j and self.matrix[i, j] > 0:
                    eta[i, j] = 1.0 / self.matrix[i, j]

        # Qubit amplitude matrix q in [0, 1]
        q_amplitudes = np.ones((n, n), dtype=np.float64) * 0.5
        np.fill_diagonal(q_amplitudes, 0.0)

        best_cost = float('inf')
        best_pure = float('inf')
        best_routes = []
        best_feas = False

        iteration = 0
        ants_constructed = 0
        rotations_performed = 0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            # Effective pheromone intensity tau = q^2 (quantum probability)
            tau = q_amplitudes ** 2

            iter_best_cost = float('inf')
            iter_best_routes = []

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

                ants_constructed += 1

                # If any stops remain, append emergency route
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

                cost, pure, pen, feas = fast_calculate_total_cost(
                    routes=ant_routes,
                    matrix=self.matrix,
                    demands=self.demands,
                    vehicle_capacity=self.capacity,
                    num_stops=self.num_stops,
                    max_vehicles=self.num_vehicles
                )

                if cost < iter_best_cost:
                    iter_best_cost = cost
                    iter_best_routes = ant_routes

                if cost < best_cost:
                    best_cost = cost
                    best_pure = pure
                    best_routes = ant_routes
                    best_feas = feas

            # Quantum rotation update on best-found edges
            # Decay all amplitude states slightly
            q_amplitudes = np.clip(q_amplitudes * (1.0 - self.decay_rate), 0.05, 0.99)

            # Rotate edges on best route towards 1.0
            if iter_best_routes:
                for r in iter_best_routes:
                    for k in range(len(r) - 1):
                        u, v = r[k], r[k + 1]
                        q_amplitudes[u, v] += self.rotation_step * (1.0 - q_amplitudes[u, v])
                        rotations_performed += 1
                q_amplitudes = np.clip(q_amplitudes, 0.05, 0.99)

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Quantum-Inspired Ant Colony Optimization (QACO)",
            category="Quantum-Inspired",
            best_cost=best_cost,
            pure_travel_time=best_pure,
            penalties=max(0.0, best_cost - best_pure),
            best_routes=best_routes,
            elapsed_sec=total_elapsed,
            is_feasible=best_feas,
            iterations=iteration,
            component_metrics={
                "ants_constructed": ants_constructed,
                "rotations_performed": rotations_performed,
                "mean_qubit_amplitude": round(float(np.mean(q_amplitudes)), 4)
            },
            metadata={"num_ants": self.num_ants, "rotation_step": self.rotation_step}
        )

def run_qaco(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = QACOSolver(
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
