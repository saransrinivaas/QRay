"""
QRay Algorithm Suite Registry
===============================
Provides uniform access to all quantum-inspired and classical routing algorithms.
"""

from typing import Dict, Any, Callable

from app.algorithms.base import AlgorithmResult
from app.algorithms.qalns import run_qalns, AdaptiveQuantumALNS
from app.algorithms.qpso import run_qpso, QPSOSolver
from app.algorithms.qpso_chaos import run_qpso_chaos, QPSOChaosSolver
from app.algorithms.qga import run_qga, QGASolver
from app.algorithms.qaco import run_qaco, QACOSolver
from app.algorithms.qasa import run_qasa, QASASolver
from app.algorithms.qss import run_qss, QSSSolver
from app.algorithms.classical_alns import run_classical_alns, ClassicalALNSSolver
from app.algorithms.dijkstra_nn import run_dijkstra_nn
from app.algorithms.clarke_wright import run_clarke_wright
from app.algorithms.classical_ga import run_classical_ga, ClassicalGASolver
from app.algorithms.classical_aco import run_classical_aco, ClassicalACOSolver
from app.algorithms.ortools_solver import run_ortools_fast, run_ortools_gls

ALGORITHM_REGISTRY: Dict[str, Dict[str, Any]] = {
    "qalns": {
        "name": "Adaptive Quantum-Guided ALNS+ (Primary)",
        "category": "Quantum-Inspired",
        "description": "Primary engine: 4 destroy ops (incl. quantum variance), greedy repair, Lorentzian tunneling, rotation gate trust, 2-opt polish.",
        "runner": run_qalns,
        "is_primary": True
    },
    "qpso": {
        "name": "Quantum-behaved PSO (QPSO)",
        "category": "Quantum-Inspired",
        "description": "Mean-best potential well and continuous key-space mapping with greedy nearest-neighbor seeding.",
        "runner": run_qpso,
        "is_primary": False
    },
    "qpso_chaos": {
        "name": "QPSO + Chaos/Mutation",
        "category": "Quantum-Inspired",
        "description": "QPSO with chaotic logistic map perturbation on stagnation.",
        "runner": run_qpso_chaos,
        "is_primary": False
    },
    "qga": {
        "name": "Quantum-Inspired GA (QGA)",
        "category": "Quantum-Inspired",
        "description": "Qubit rotation angle representation with Han & Kim rotation gates and angle-flip mutation.",
        "runner": run_qga,
        "is_primary": False
    },
    "qaco": {
        "name": "Quantum-Inspired ACO (QACO)",
        "category": "Quantum-Inspired",
        "description": "Qubit amplitude pheromones with quantum rotation reinforcement on best-found routes.",
        "runner": run_qaco,
        "is_primary": False
    },
    "qasa": {
        "name": "Quantum-Annealing Local Search (QASA)",
        "category": "Quantum-Inspired",
        "description": "Fast 2-opt and Or-opt local moves evaluated with Lorentzian quantum-tunneling acceptance schedule.",
        "runner": run_qasa,
        "is_primary": False
    },
    "qss": {
        "name": "Quantum Solution Swarm (QSS)",
        "category": "Quantum-Inspired",
        "description": "Swarm of complete solutions weighted by softmax quantum amplitudes to form edge consensus.",
        "runner": run_qss,
        "is_primary": False
    },
    "classical_alns": {
        "name": "Classical ALNS (Boltzmann SA Control)",
        "category": "Classical Baseline",
        "description": "Uniform random destroy, greedy repair, and classical Boltzmann simulated annealing acceptance.",
        "runner": run_classical_alns,
        "is_primary": False
    },
    "dijkstra_nn": {
        "name": "Dijkstra / Nearest Neighbor",
        "category": "Classical Baseline",
        "description": "Deterministic greedy nearest-neighbor construction.",
        "runner": run_dijkstra_nn,
        "is_primary": False
    },
    "clarke_wright": {
        "name": "Clarke-Wright Savings",
        "category": "Classical Baseline",
        "description": "Savings-based route merging heuristic.",
        "runner": run_clarke_wright,
        "is_primary": False
    },
    "classical_ga": {
        "name": "Classical Genetic Algorithm (GA)",
        "category": "Classical Baseline",
        "description": "Permutation chromosome with OX crossover, swap mutation, and elitism.",
        "runner": run_classical_ga,
        "is_primary": False
    },
    "classical_aco": {
        "name": "Classical Ant Colony Optimization (ACO)",
        "category": "Classical Baseline",
        "description": "Pheromone trail evaporation and deposit across ant solutions.",
        "runner": run_classical_aco,
        "is_primary": False
    },
    "ortools_fast": {
        "name": "OR-Tools (Fast / Cheapest Arc)",
        "category": "Industry Benchmark",
        "description": "OR-Tools first solution strategy using PATH_CHEAPEST_ARC.",
        "runner": run_ortools_fast,
        "is_primary": False
    },
    "ortools_gls": {
        "name": "OR-Tools (Guided Local Search)",
        "category": "Industry Benchmark",
        "description": "OR-Tools Guided Local Search metaheuristic baseline.",
        "runner": run_ortools_gls,
        "is_primary": False
    }
}

def list_algorithms() -> Dict[str, Dict[str, Any]]:
    return {
        key: {
            "name": val["name"],
            "category": val["category"],
            "description": val["description"],
            "is_primary": val["is_primary"]
        }
        for key, val in ALGORITHM_REGISTRY.items()
    }

def get_algorithm(key: str) -> Callable:
    if key not in ALGORITHM_REGISTRY:
        raise KeyError(f"Unknown algorithm '{key}'. Choose from: {list(ALGORITHM_REGISTRY.keys())}")
    return ALGORITHM_REGISTRY[key]["runner"]
