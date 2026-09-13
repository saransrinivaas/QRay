"""
QRay Quantum-behaved Particle Swarm Optimization (QPSO)
==========================================================
Implementation based on Sun, Xu & Feng (2004) and Appendix A.1 of QRay Guide.

Continuous key-space [0, 1]^N optimization with:
- Mean-best position (mbest)
- Local attractor p_i
- Quantum delta potential well update
- VRP-aware Nearest-Neighbor heuristic seeding
- Step-wise vector execution & perturbation hooks (Chaos Logistic Map & 2-Opt Polishing)
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

def decode_keys_to_routes(
    keys: np.ndarray,
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int
) -> List[List[int]]:
    """
    Decodes a continuous key vector x in [0, 1]^N into CVRP vehicle routes:
    Sorts customer stops by key value, then greedily splits across vehicles on capacity limit.
    """
    sorted_order = np.argsort(keys) + 1  # 1-indexed customer stop IDs
    routes = []
    current_route = [0]
    current_load = 0.0

    for stop in sorted_order:
        stop = int(stop)
        demand = demands.get(stop, 0.0)
        if current_load + demand <= vehicle_capacity:
            current_route.append(stop)
            current_load += demand
        else:
            current_route.append(0)
            routes.append(current_route)
            current_route = [0, stop]
            current_load = demand

    if len(current_route) > 1:
        current_route.append(0)
        routes.append(current_route)

    while len(routes) < num_vehicles:
        routes.append([0, 0])

    return routes


def encode_routes_to_keys(routes: List[List[int]], num_stops: int) -> np.ndarray:
    """Converts discrete route order into normalized rank keys in [0, 1]."""
    keys = np.zeros(num_stops, dtype=np.float64)
    rank = 0
    for route in routes:
        for node in route:
            if node != 0 and node <= num_stops:
                keys[node - 1] = rank / max(1, num_stops - 1)
                rank += 1
    return keys


class LogisticChaosGenerator:
    """
    Generates chaotic pseudo-random numbers using the Logistic Map: x_{k+1} = 4 * x_k * (1 - x_k)
    """
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


def apply_chaos_mutation(
    particles: np.ndarray,
    pbest_costs: np.ndarray,
    stagnant_threshold: int = 10,
    current_stagnant: int = 0
) -> Tuple[np.ndarray, bool]:
    """
    Applies chaos perturbation and mutation to weak particles if search is stagnant.
    """
    if current_stagnant < stagnant_threshold:
        return particles, False

    swarm_size, dimension = particles.shape
    sorted_by_cost = np.argsort(pbest_costs)
    worst_indices = sorted_by_cost[swarm_size // 2:]

    chaos_gen = LogisticChaosGenerator(seed=0.618)
    num_to_perturb = len(worst_indices)
    chaos_matrix = chaos_gen.fill_array((num_to_perturb, dimension))

    for idx_pos, particle_idx in enumerate(worst_indices):
        chaos_vector = chaos_matrix[idx_pos]
        gaussian_mutation = np.random.normal(0.0, 0.1, dimension)
        particles[particle_idx] = 0.7 * particles[particle_idx] + 0.2 * chaos_vector + 0.1 * gaussian_mutation
        particles[particle_idx] = np.clip(particles[particle_idx], 0.0, 1.0)

    return particles, True


def run_single_pass_2opt(
    route: List[int],
    matrix: np.ndarray
) -> Tuple[List[int], bool]:
    """
    Runs 1 quick pass of 2-opt edge swapping on a single vehicle route.
    """
    if len(route) < 5:
        return route, False

    best_route = list(route)
    improved = False
    n = len(best_route)

    for i in range(1, n - 3):
        for j in range(i + 1, n - 1):
            if j - i == 1:
                continue

            u1, v1 = best_route[i - 1], best_route[i]
            u2, v2 = best_route[j], best_route[j + 1]

            current_cost = matrix[u1, v1] + matrix[u2, v2]
            new_cost = matrix[u1, u2] + matrix[v1, v2]

            if new_cost < current_cost - 1e-4:
                best_route[i:j + 1] = reversed(best_route[i:j + 1])
                improved = True
                break
        if improved:
            break

    return best_route, improved


def polish_gbest_routes_2opt(
    routes: List[List[int]],
    evaluator: Any,
    iteration: int,
    frequency: int = 15
) -> Tuple[List[List[int]], float, bool]:
    """
    Polishes global best routes using guarded 2-opt.
    Supports either FeasibilityEvaluator (with .evaluate_routes / .matrix)
    or matrix & fast_calculate_total_cost directly.
    """
    if iteration == 0 or iteration % frequency != 0:
        if hasattr(evaluator, "evaluate_routes"):
            total_cost, pure_time, penalties, _ = evaluator.evaluate_routes(routes)
        else:
            total_cost = routes[0] if isinstance(routes[0], (int, float)) else 0.0
        return routes, total_cost, False

    matrix = getattr(evaluator, "matrix", None)
    if matrix is None and hasattr(evaluator, "travel_time_matrix"):
        matrix = evaluator.travel_time_matrix

    polished_routes = []
    any_improved = False

    for r in routes:
        if matrix is not None:
            new_r, imp = run_single_pass_2opt(r, matrix)
        else:
            new_r, imp = r, False
        polished_routes.append(new_r)
        if imp:
            any_improved = True

    if hasattr(evaluator, "evaluate_routes"):
        total_cost, pure_time, penalties, _ = evaluator.evaluate_routes(polished_routes)
    else:
        total_cost = 0.0

    return polished_routes, total_cost, any_improved


class QPSOEngine:
    """
    Full-featured iterative QPSO Engine supporting single-step execution,
    heuristic seeding, dynamic warm-restart, chaos perturbation, and 2-opt polishing.
    Used for simulation timelines, interactive visualizations, and parameter grid sweeps.
    """

    def __init__(
        self,
        road_network: Any,
        evaluator: Any,
        swarm_size: int = 30,
        alpha: float = 0.7,
        max_iterations: int = 150,
        seed: int = 42
    ):
        self.network = road_network
        self.evaluator = evaluator
        self.swarm_size = swarm_size
        self.alpha = alpha
        self.max_iterations = max_iterations
        self.dimension = road_network.num_nodes
        self.seed = seed

        np.random.seed(self.seed)

        self.particles = np.random.uniform(0.0, 1.0, (self.swarm_size, self.dimension))
        self.pbest_positions = np.copy(self.particles)
        self.pbest_costs = np.full(self.swarm_size, fill_value=float('inf'))

        self.gbest_position = np.zeros(self.dimension)
        self.gbest_cost = float('inf')
        self.gbest_routes = []
        self.gbest_details = {}

        self.cost_history = []
        self.stagnant_iterations = 0

    def evaluate_particle(self, particle: np.ndarray) -> Tuple[float, List[List[int]], Dict[str, Any]]:
        """Decodes particle keys -> routes and computes fitness cost."""
        routes = self.network.decode_particle_to_routes(particle)
        total_cost, pure_time, penalty, details = self.evaluator.evaluate_routes(routes)
        return total_cost, routes, details

    def initialize_swarm(self, seed_heuristic: bool = True, exploration_ratio: float = 0.0):
        """Initializes the swarm, optionally seeding from Nearest-Neighbor greedy keys."""
        if seed_heuristic:
            nn_keys = self.network.get_vrp_seeded_keys()
            self.particles[0] = np.clip(nn_keys, 0.0, 1.0)

            num_random = int(self.swarm_size * exploration_ratio)
            num_seeded = self.swarm_size - num_random

            for i in range(1, num_seeded):
                noise = np.random.normal(0.0, 0.12, self.dimension)
                self.particles[i] = np.clip(nn_keys + noise, 0.0, 1.0)

            for i in range(num_seeded, self.swarm_size):
                self.particles[i] = np.random.uniform(0.0, 1.0, self.dimension)

        for i in range(self.swarm_size):
            cost, routes, details = self.evaluate_particle(self.particles[i])
            self.pbest_costs[i] = cost
            self.pbest_positions[i] = np.copy(self.particles[i])

            if cost < self.gbest_cost:
                self.gbest_cost = cost
                self.gbest_position = np.copy(self.particles[i])
                self.gbest_routes = routes
                self.gbest_details = details

    def step_vectorized_qpso(self):
        """Executes ONE iteration of vectorized QPSO update."""
        mbest = np.mean(self.pbest_positions, axis=0)
        phi = np.random.uniform(0.0, 1.0, (self.swarm_size, self.dimension))
        u = np.random.uniform(1e-10, 1.0, (self.swarm_size, self.dimension))
        sign = np.random.choice([-1.0, 1.0], size=(self.swarm_size, self.dimension))

        attractor = phi * self.pbest_positions + (1.0 - phi) * self.gbest_position
        mbest_diff = np.abs(mbest - self.particles)
        quantum_step = sign * self.alpha * mbest_diff * np.log(1.0 / u)
        self.particles = np.clip(attractor + quantum_step, 0.0, 1.0)

        improved = False
        for i in range(self.swarm_size):
            cost, routes, details = self.evaluate_particle(self.particles[i])

            if cost < self.pbest_costs[i]:
                self.pbest_costs[i] = cost
                self.pbest_positions[i] = np.copy(self.particles[i])

            if cost < self.gbest_cost:
                self.gbest_cost = cost
                self.gbest_position = np.copy(self.particles[i])
                self.gbest_routes = routes
                self.gbest_details = details
                improved = True

        if improved:
            self.stagnant_iterations = 0
        else:
            self.stagnant_iterations += 1

        self.cost_history.append(self.gbest_cost)


class QPSOSolver:
    """
    Standardized benchmark solver conforming to the 14-algorithm benchmarking suite.
    """

    def __init__(
        self,
        matrix: np.ndarray,
        demands: Dict[int, float],
        vehicle_capacity: float,
        num_stops: int,
        num_vehicles: int,
        swarm_size: int = 30,
        alpha: float = 0.7,
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
        self.time_budget_sec = max(time_budget_sec, 0.01)
        self.max_iterations = max_iterations
        self.seed = seed

        np.random.seed(seed)

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

        t_eval = 0.0
        for i in range(self.swarm_size):
            t0 = time.perf_counter()
            cost, pure, pen, routes, feas = self._eval(particles[i])
            t_eval += (time.perf_counter() - t0)

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
        t_math = 0.0

        while True:
            elapsed = time.perf_counter() - start_time
            if self.max_iterations is not None:
                if iteration >= self.max_iterations:
                    break
            else:
                if elapsed >= self.time_budget_sec:
                    break

            t0 = time.perf_counter()
            mbest = np.mean(pbest_positions, axis=0)

            phi = np.random.uniform(0.0, 1.0, (self.swarm_size, dim))
            u = np.random.uniform(1e-10, 1.0, (self.swarm_size, dim))
            sign = np.random.choice([-1.0, 1.0], size=(self.swarm_size, dim))
            attractor = phi * pbest_positions + (1.0 - phi) * gbest_position

            mbest_diff = np.abs(mbest - particles)
            step = sign * self.alpha * mbest_diff * np.log(1.0 / u)
            particles = np.clip(attractor + step, 0.0, 1.0)
            t_math += (time.perf_counter() - t0)

            for i in range(self.swarm_size):
                t0 = time.perf_counter()
                cost, pure, pen, routes, feas = self._eval(particles[i])
                t_eval += (time.perf_counter() - t0)

                if cost < pbest_costs[i]:
                    pbest_costs[i] = cost
                    pbest_positions[i] = np.copy(particles[i])
                    pbest_pure[i] = pure
                    pbest_routes[i] = routes

                if cost < gbest_cost:
                    gbest_cost = cost
                    gbest_pure = pure
                    gbest_position = np.copy(particles[i])
                    gbest_routes = routes
                    gbest_feasible = feas

            iteration += 1

        total_elapsed = time.perf_counter() - start_time
        return AlgorithmResult(
            algorithm_name="Quantum-behaved Particle Swarm Optimization (QPSO)",
            category="Quantum-Inspired",
            best_cost=gbest_cost,
            pure_travel_time=gbest_pure,
            penalties=max(0.0, gbest_cost - gbest_pure),
            best_routes=gbest_routes,
            elapsed_sec=total_elapsed,
            is_feasible=gbest_feasible,
            iterations=iteration,
            component_metrics={
                "qpso_math_ms": round(t_math * 1000.0, 2),
                "evaluation_ms": round(t_eval * 1000.0, 2),
                "mbest_dim": dim
            },
            metadata={"swarm_size": self.swarm_size, "alpha": self.alpha}
        )

def run_qpso(
    matrix: np.ndarray,
    demands: Dict[int, float],
    vehicle_capacity: float,
    num_stops: int,
    num_vehicles: int,
    time_budget_sec: float = 0.5,
    max_iterations: Optional[int] = None,
    seed: int = 42
) -> AlgorithmResult:
    solver = QPSOSolver(
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
