# QRay Pipeline Overview
## Adaptive Quantum-Guided ALNS+ Routing Engine (v5 Implementation)

This document explains the architecture of the **QRay Traffic Routing Pipeline** in simple, clear, technical terms. It follows the **KISS principle** (Keep It Simple, Stupid) so anyone reading it can understand **what** is in the pipeline, **why** it is there, and **where** it is located in the codebase.

---

## 1. Executive Summary & Architecture Diagram

QRay solves the **Capacitated Vehicle Routing Problem (CVRP)** under dynamic live traffic conditions. Based on rigorous empirical benchmarking documented in the QRay Implementation Guide, the core primary engine has transitioned from continuous-key QPSO to **Adaptive Quantum-Guided ALNS+ (Large Neighborhood Search)**, which consistently beats both QPSO and classical baselines on speed, feasibility, and solution quality across all problem scales.

```
+-----------------------------------------------------------------------------------------+
|                    QRay 5-Layer Operational Architecture (v5)                         |
+-----------------------------------------------------------------------------------------+
| Layer 1: Graph & Encoding         --> Precomputed pairwise travel-time matrix (NumPy)   |
|                                       Direct vehicle route representation               |
|                                                                                         |
| Layer 2 + 3: Core Search Engine   --> Adaptive Quantum-Guided ALNS+ Continuous Loop:    |
|   1. DESTROY (4 Operators)        --> Random, Worst Detour, Related (Shaw),             |
|                                       and Quantum-Variance Shadow Swarm                 |
|   2. REPAIR                       --> Vectorized Greedy Insertion (No slow Regret-2)    |
|   3. ACCEPTANCE                   --> Quantum-Tunneling Lorentzian schedule             |
|   4. ROTATION GATE                --> Adaptive operator trust weight updates            |
|   5. POLISH (Every 30 iters)      --> Guarded 1-pass 2-opt edge swap                    |
|                                                                                         |
| Layer 4: Dynamic Time-Slicing     --> Live traffic update & warm-start from best routes |
| Layer 5: Fast Feasibility & Cost  --> Vectorized flat-tour NumPy distance evaluations   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Layer-by-Layer Detailed Breakdown

### Layer 1: Graph & Encoding
- **WHAT IS THERE**:
  - Precomputes an $(N+1) \times (N+1)$ distance/travel-time matrix once as a NumPy array (where node 0 is the central depot).
  - Solution representation: list of routes, one per truck, where each route is an ordered list of stop numbers `[0, s1, s2, ..., 0]`.
- **WHY IT IS THERE**:
  - **Performance Trick #1**: Calculating road travel times on the fly during search is extremely slow. Precomputing the distance matrix **ONCE** converts pairwise distance checks into immediate array indexing.
- **WHERE IT IS THERE**:
  - Implementation: [graph.py](backend/app/core/graph.py)
  - Base Primitives: [base.py](backend/app/algorithms/base.py)

---

#### Layer 2 + 3: Core Search Engine (Adaptive Quantum-Guided ALNS+ — Primary Pipeline)
The intelligent search operates as an integrated quantum-mechanics-guided continuous loop:

1. **Greedy Nearest-Neighbor Initialization + 2-Opt Polish**:
   - The search begins from a deterministic greedy baseline and applies an initial 2-opt pass, ensuring the search can never terminate worse than greedy.
2. **Five Dynamic Destroy Operators** (Section 3.4):
   - **Random Removal**: Uniformly removes $k$ stops to maintain global exploration.
   - **Worst (Detour) Removal**: Removes stops that cause the largest detour overhead $\Delta = d(prev, s) + d(s, next) - d(prev, next)$.
   - **Related (Shaw) Removal**: Reshuffles localized clusters by removing stops close in geographic and sequence distance.
   - **Quantum-Variance Removal**: Simulates an 8-copy shadow swarm with Gaussian quantum perturbations in normalized key space, calculates positional variance (disagreement) across the swarm, and removes high-variance stops.
   - **Or-Opt Segment Relocation**: Extracts multi-stop segments (lengths 1 to 3) across routes to break structural deadlocks.
3. **Anchor-Guided Quantum Priority Insertion Repair** (Section 3.5.2):
   - Prioritizes outlying anchor stops by combined distance-to-depot and cargo demand ratio, ensuring structural backbone routes are formed first before filling interstitial slots.
   - Operates in linear $O(K \cdot N)$ complexity, matching Classical ALNS in iteration speed (>1,000 it/s) while strictly honoring Section 4.4 freight locking.
4. **Quantum-Tunneling Lorentzian Acceptance Schedule** (Section 3.6):
   - Accepts improving moves ($\Delta < 0$) unconditionally.
   - Accepts uphill moves ($\Delta \ge 0$) with Lorentzian quantum-tunneling probability:
     $$P(\text{accept} \mid \Delta) = \frac{1}{1 + (\Delta / \Gamma)^2}$$
     where $\Gamma(t) = \Gamma_0 \cdot \max(0.02, 1 - t/T)^2$.
5. **Adaptive Rotation-Gate Operator Weighting** (Section 3.4.5):
   - Continuous reward-based weight nudges scale probability mass toward operators that discover improving trajectories.
6. **Stagnation-Triggered Quantum Perturbation Restart** (Section 3.8):
   - When the search plateaus, quantum perturbation injects controlled energy to escape local minima.
7. **Periodic Polish with Drift Protection & Inter-Route Customer Relocation**:
   - Periodic fast edge uncrossing during search with attractor basin re-anchoring when search drifts.
   - Multi-vehicle inter-route customer relocation polish to resolve cross-route crossovers that 2-opt alone cannot fix.
- **WHERE IT IS THERE**:
   - Primary Solver: [qalns.py](backend/app/algorithms/qalns.py) — Class: `AdaptiveQuantumALNS`

---

### Layer 4: Dynamic State Transformation & Real-Time Re-Routing (Section 4.4)
- **WHAT IS THERE**:
  - Full mid-route vehicle dispatch and live disturbance management implementing **Section 4.4 of the specification** ([dynamic_state.py](backend/app/core/dynamic_state.py)):
    1. **Truck State Transform (`apply_truck_state_transform`)**:
       - Tracks instantaneous physical truck states $(\text{lat}_k, \text{lng}_k)$ and cumulative delivered cargo load $u_k$.
       - Adjusts remaining vehicle capacity dynamically:
         $$Q'_k = Q_k - \sum_{i \in \mathcal{S}_k^{\text{done}}} q_i$$
       - Partitions customer demands: already visited stops have demand set to 0 and are omitted from future tours.
    2. **Effective Start Distances from Live Coordinates (`build_effective_start_distances`)**:
       - Calculates exact Euclidean/Haversine distance from the truck's real-time geographic position $p_k$ to all pending stops $j$:
         $$d(p_k, j) = \|p_k - \text{coord}_j\|_2$$
       - Replaces standard depot-to-stop arcs $d(0, j)$ with $d(p_k, j)$ for the first leg of each vehicle's remaining route, ensuring continuous progression without resetting back to the depot.
    3. **Pre-Loaded Cargo Stop Locks (`build_stop_locks`)**:
       - Binds pending parcels already physically loaded onto truck $k$ ($\text{locked\_to}[s] = k$).
       - Prohibits operators from illegally transferring physical freight between en-route vehicles.
    4. **Lock-Respecting Repair (`repair_respecting_locks`)**:
       - Enforces lock constraints in `_greedy_insertion_repair`: locked stops are evaluated and inserted exclusively into their designated vehicle's route.
    5. **Solver Warm-Start with Tight Dynamic Time Budgets**:
       - Updates the distance matrix with road closures/congestion and feeds the current route sub-tours as `starting_solution` with a rapid ~100–120ms compute budget for instantaneous response.
- **WHY IT IS THERE**:
  - Re-optimizing from scratch when a disturbance occurs either jumps trucks back to depot or wastes seconds re-planning already completed stops.
  - Locking and coordinate offsets enable mathematically rigorous, instantaneous dispatch updates (< 2 ms preprocessing).
- **EMPIRICAL PERFORMANCE** ([dynamic_state.py](backend/app/core/dynamic_state.py) micro-benchmarks):
  - **Truck State Transform**: $80 - 213\,\mu\text{s}$ per call across $35 - 300$ stops.
  - **Full Layer 4 Preprocessing**: $0.10 - 1.91\,\text{ms}$ per call ($< 3.3\%$ of the 58ms dispatch latency budget).
- **WHERE IT IS THERE**:
  - State Transformation & Preprocessing: [dynamic_state.py](backend/app/core/dynamic_state.py) — `apply_truck_state_transform`, `build_effective_start_distances`, `build_stop_locks`, `repair_respecting_locks`
  - Solver Warm-Start & Lock Enforcement: [qalns.py](backend/app/algorithms/qalns.py) — `solve(starting_solution=..., locked_to=...)`
  - Dynamic Simulation Runner: [demo_simulation.py](backend/app/core/demo_simulation.py) & [main.py](backend/app/main.py)

---

### Layer 5: Fast Feasibility & Vectorized Cost Calculation
- **WHAT IS THERE**:
  - Evaluates physical travel time and checks CVRP feasibility constraints:
    1. Vehicle capacity limits (no overloaded trucks).
    2. Single visit per stop (no missed or duplicate customer stops).
    3. Mandatory depot origin and destination (starts and ends at depot node 0).
    4. Vehicle fleet limit.
  - Applies penalty weights to infeasible solutions during exploration.
  - **Vectorized Flat-Tour Evaluation**: Concatenates routes into NumPy arrays and computes total travel time with vector slices `matrix[arr[:-1], arr[1:]]`.
- **WHY IT IS THERE**:
  - In initial testing, cost calculation and feasibility checks consumed 65–93% of CPU time. Vectorization unlocked a **4x to 7x speedup**, enabling thousands of candidate evaluations per second.
- **WHERE IT IS THERE**:
  - Vectorized Cost Calculator: [base.py](backend/app/algorithms/base.py) — `fast_calculate_total_cost()`
  - Evaluator Class: [feasibility.py](backend/app/core/feasibility.py) — `FeasibilityEvaluator`

---

## 3. The 14-Algorithm Benchmarking Suite

All algorithms in QRay are registered in [algorithms/__init__.py](backend/app/algorithms/__init__.py) (`ALGORITHM_REGISTRY`) and implemented as modular runners under [backend/app/algorithms/](backend/app/algorithms/):

| Algorithm Key | Category | Module File | Description |
| :--- | :--- | :--- | :--- |
| **`qalns`** | Quantum-Inspired | [qalns.py](backend/app/algorithms/qalns.py) | **Primary Contender**: Adaptive Quantum-Guided ALNS+ |
| `qpso` | Quantum-Inspired | [qpso.py](backend/app/algorithms/qpso.py) | Quantum-behaved Particle Swarm with VRP heuristic seeding |
| `qpso_chaos` | Quantum-Inspired | [qpso_chaos.py](backend/app/algorithms/qpso_chaos.py) | QPSO + chaotic logistic map mutation on stagnation |
| `qga` | Quantum-Inspired | [qga.py](backend/app/algorithms/qga.py) | Quantum-Inspired GA with Han & Kim rotation gates |
| `qaco` | Quantum-Inspired | [qaco.py](backend/app/algorithms/qaco.py) | Quantum-Inspired ACO with qubit amplitude pheromones |
| `qasa` | Quantum-Inspired | [qasa.py](backend/app/algorithms/qasa.py) | Quantum-Annealing-Inspired Local Search (sub-20ms latency) |
| `qss` | Quantum-Inspired | [qss.py](backend/app/algorithms/qss.py) | Quantum Solution Swarm with softmax consensus voting |
| `classical_alns`| Classical Baseline | [classical_alns.py](backend/app/algorithms/classical_alns.py) | Uniform destroy + Boltzmann simulated annealing control |
| `dijkstra_nn` | Classical Baseline | [dijkstra_nn.py](backend/app/algorithms/dijkstra_nn.py) | Greedy Nearest Neighbor deterministic baseline |
| `clarke_wright` | Classical Baseline | [clarke_wright.py](backend/app/algorithms/clarke_wright.py) | Clarke-Wright savings-based route merging |
| `classical_ga` | Classical Baseline | [classical_ga.py](backend/app/algorithms/classical_ga.py) | Permutation GA with OX crossover, swap mutation, elitism |
| `classical_aco` | Classical Baseline | [classical_aco.py](backend/app/algorithms/classical_aco.py) | Ant Colony Optimization with linear pheromone decay |
| `ortools_fast` | Industry Benchmark | [ortools_solver.py](backend/app/algorithms/ortools_solver.py) | OR-Tools PATH_CHEAPEST_ARC first solution heuristic |
| `ortools_gls` | Industry Benchmark | [ortools_solver.py](backend/app/algorithms/ortools_solver.py) | OR-Tools Guided Local Search metaheuristic |

---

## 4. CLI Runner & Execution Shortcuts

A dedicated CLI benchmark runner allows running head-to-head empirical comparisons and component tests directly from the terminal:

- **Run all 5 scales (Micro, Small, Medium, Large, XL)**:
  ```powershell
  python backend/run_benchmark.py --scale all
  ```
- **Quick test on Micro (15 stops)**:
  ```powershell
  python backend/run_benchmark.py --scale micro
  ```
- **Run comprehensive component-level empirical tests**:
  ```powershell
  python backend/run_benchmark.py --components
  ```
- **Test a single algorithm on Small scale**:
  ```powershell
  python backend/run_benchmark.py --scale small --algo qalns
  ```
- **Results exported to**: `backend/empirical_benchmark_summary.json` (also served by FastAPI at `/api/benchmark` and `/api/components`).
