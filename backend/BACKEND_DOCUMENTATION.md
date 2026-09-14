# QRay Backend Engine — Technical Architecture & API Documentation

## 1. System Overview

**QRay** is an enterprise-grade, quantum-inspired dynamic fleet routing and benchmarking engine built for large-scale Capacitated Vehicle Routing Problems (CVRP) with real-time traffic disruption handling.

The backend is built with **Python 3.10+ / FastAPI** and delivers sub-50ms combinatorial route optimization, multi-trip vehicle allocation, split-delivery capacity handling, and automated Google Directions / OSRM road network geometry synthesis.

```
                                  ┌────────────────────────┐
                                  │   FastAPI REST API     │
                                  │    (Uvicorn Engine)    │
                                  └───────────┬────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
         ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
         │  Algorithms Suite  │    │ Dynamic Simulation │    │ Empirical Benchmark│
         │   (12 Solvers)     │    │   & Road Routing   │    │  (5 Problem Scales)│
         └──────────┬─────────┘    └──────────┬─────────┘    └──────────┬─────────┘
                    │                         │                         │
                    ▼                         ▼                         ▼
         ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
         │ QALNS+ Primary VRP │    │ Google/OSRM Cache  │    │ OR-Tools / GA /    │
         │ (Quantum Tunneling)│    │ (road_cache.json)  │    │ Dijkstra Baselines │
         └────────────────────┘    └────────────────────┘    └────────────────────┘
```

---

## 2. Technology Stack & Dependencies

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **API Framework** | FastAPI `0.95.0+` | High-performance asynchronous REST endpoints & OpenAPI schema |
| **ASGI Server** | Uvicorn `0.20.0+` | Lightning-fast async event loop server |
| **Data Validation** | Pydantic `2.0.0+` | Strict schema serialization, parsing, and type safety |
| **Scientific Compute** | NumPy `1.22.0+`, SciPy `1.8.0+` | Vectorized distance matrices, delta-well equations, chaos maps |
| **Graph Modeling** | NetworkX `2.8.0+` | Road topology, graph shortest paths, and network flows |
| **Geospatial & Roads** | Google Directions API + OSRM | Road-accurate turn-by-turn polyline generation and step geometry |

---

## 3. Algorithm Suite (`app/algorithms/`)

QRay incorporates **12 optimization algorithms** categorised into Quantum-Inspired Metaheuristics, Classical Baselines, and Industry Benchmarks.

```
app/algorithms/
├── base.py              # BaseAlgorithm interface & AlgorithmResult dataclass
├── qalns.py             # Adaptive Quantum-Guided ALNS+ (Primary Engine)
├── qpso.py              # Quantum-behaved Particle Swarm Optimization
├── qpso_chaos.py        # QPSO with Chaotic Mutation Maps (Logistic/Henon)
├── qga.py               # Quantum Genetic Algorithm (Qubit Bloch Spheres)
├── qaco.py              # Quantum Ant Colony Optimization (Probability Amplitudes)
├── qasa.py              # Quantum Annealing-Inspired Simulated Annealing
├── qss.py               # Quantum Solution Swarm (Consensus Voting)
├── ortools_solver.py    # Google OR-Tools (Cheapest Arc Fast + GLS Metaheuristic)
├── classical_alns.py    # Classical ALNS (Standard Boltzmann Acceptance)
├── classical_ga.py      # Classical Genetic Algorithm (OX Crossover + Swap Mutation)
├── classical_aco.py     # Classical Ant Colony (Dorigo Pheromone Evaporation)
├── clarke_wright.py     # Clarke-Wright Savings Merge Heuristic
├── dijkstra_nn.py       # Greedy Dijkstra / Nearest-Neighbor Tour Builder
└── component_tests.py   # Operator Ablation & Empirical Component Isolators
```

### 3.1 Primary Algorithm: Adaptive Quantum-Guided ALNS+ (`qalns.py`)

The primary routing pipeline is an **Adaptive Large Neighborhood Search** supercharged with three quantum-inspired mechanisms:

1. **Quantum Variance Destroy Operator**:
   - Calculates customer route variance across a shadow swarm of solutions. High-variance nodes (uncertain positions) are selectively destroyed and re-inserted into optimal clusters.
2. **Qubit Amplitude Rotation-Gate Adaptive Operator Selection**:
   - Operators maintain probability amplitude state vectors $(\alpha_i, \beta_i)$ on the unit circle ($|\alpha_i|^2 + |\beta_i|^2 = 1$).
   - Upon finding an improved route, rotation gates $\theta = \pm \Delta \theta$ update operator selection weights adaptively without heuristic hardcoding.
3. **Logistic Chaos Tunneling (Stagnation Escape)**:
   - When trapped in local minima for $k$ iterations, the acceptance probability transitions to a chaotic logistic map perturbation ($x_{n+1} = 4x_n(1 - x_n)$), tunneling through cost barriers faster than classical simulated annealing.
4. **Warm-Restart Dynamic Detours**:
   - When a traffic incident strikes, completed stops and unaffected routes are locked in $O(1)$. Only downstream unserved nodes on the blocked corridor undergo neighborhood destruction and instant repair ($<35\text{ ms}$).

---

## 4. REST API Reference

### 4.1 Health Check & Algorithm Registry

#### `GET /`
- **Description**: Verifies API service status.
- **Response**:
```json
{
  "message": "QRay Quantum-Inspired Traffic Routing API is Running!"
}
```

#### `GET /api/algorithms`
- **Description**: Lists all 12 registered algorithms with metadata, complexity classes, and primary tags.
- **Response**:
```json
[
  {
    "key": "qalns",
    "name": "Adaptive Quantum-Guided ALNS+ (Primary)",
    "category": "Quantum-Inspired",
    "is_primary": true,
    "description": "Quantum-variance destroy operator with qubit rotation gate adaptive weights and chaos tunneling."
  },
  {
    "key": "ortools_fast",
    "name": "Google OR-Tools (Cheapest Arc Fast)",
    "category": "Industry Benchmark",
    "is_primary": false,
    "description": "Industry benchmark running PATH_CHEAPEST_ARC first solution strategy."
  }
]
```

---

### 4.2 Dynamic Scenario Simulation & Routing

#### `POST /api/demo/simulate`
- **Description**: Precomputes complete 12-hour simulation state up-front (initial routes, disruption injection, warm-restart rerouting, road-snapped polylines) for 60fps zero-latency frontend playback.
- **Request Body**:
```json
{
  "stops": [
    { "id": 0, "name": "Depot", "lat": 13.0827, "lng": 80.2707, "demand": 0, "enabled": true, "is_depot": true },
    { "id": 1, "name": "Anna Nagar", "lat": 13.0850, "lng": 80.2101, "demand": 15, "enabled": true }
  ],
  "vehicles": [
    { "id": 0, "name": "Alpha", "capacity": 120, "color": "#ffffff" },
    { "id": 1, "name": "Beta", "capacity": 120, "color": "#38bdf8" }
  ],
  "algo": "qalns",
  "seed": 42,
  "traffic_mode": "auto"
}
```
- **Response**:
```json
{
  "initial_routes": [
    {
      "vehicle_id": 0,
      "vehicle_name": "Alpha",
      "color": "#ffffff",
      "load": 85.0,
      "capacity": 120.0,
      "route_dist_km": 24.2,
      "stops": [...],
      "roadPath": [
        { "lat": 13.0827, "lng": 80.2707 },
        { "lat": 13.0831, "lng": 80.2695 }
      ]
    }
  ],
  "rerouted_routes": [...],
  "disruption": {
    "stop_id": 3,
    "stop_name": "Guindy Industrial Estate",
    "time": 0.35,
    "can_reroute": true,
    "reroute_saved_min": 8.4,
    "decision_message": "Incident detected. Warm-restart detour active."
  },
  "solve_time_ms": 38.4,
  "reroute_ms": 22.1,
  "total_dist_km": 42.1,
  "rerouted_dist_km": 43.6,
  "algo": "Adaptive Quantum-Guided ALNS+",
  "algo_key": "qalns",
  "feasible": true
}
```

#### `POST /api/demo/road-route`
- **Description**: Proxy with disk-backed cache (`road_cache.json`) for Google Directions and OSRM driving routes.
- **Request Body**:
```json
{
  "origin": { "lat": 13.0827, "lng": 80.2707 },
  "destination": { "lat": 13.0405, "lng": 80.2337 },
  "waypoints": []
}
```
- **Response**:
```json
{
  "path": [
    { "lat": 13.0827, "lng": 80.2707 },
    { "lat": 13.0815, "lng": 80.2689 }
  ],
  "distanceMeters": 6420,
  "durationSeconds": 850,
  "source": "google"
}
```

---

### 4.3 Empirical Benchmarking Lab

#### `GET /api/benchmark`
- **Description**: Serves pre-computed empirical comparison matrix across all 5 benchmark scales (Micro: 15 stops to XL: 300 stops).
- **Response**:
```json
{
  "micro": { "QALNS": { "avg_cost": 240.2, "solve_time_ms": 12.4 }, "Google_OR_Tools": { ... } },
  "small": { ... },
  "medium": { ... },
  "large": { ... },
  "xl": { ... }
}
```

#### `POST /api/benchmark/run`
- **Description**: Dynamically executes benchmark suite on the server for a specific scale and algorithm.
- **Request Body**:
```json
{
  "scale": "medium",
  "algo": "all",
  "time_budget": 0.5
}
```

#### `GET /api/runtime-comparison`
- **Description**: Serves speedup multiplier and quality gap metrics comparing QRay against Google OR-Tools (Fast & GLS modes).

#### `GET /api/components`
- **Description**: Returns ablation test data demonstrating component contributions (Quantum Tunneling vs Boltzmann, Variance Destroy vs Random, Chaos Perturbation).

---

## 5. Core Submodules (`app/core/`)

### 5.1 `graph.py` (`RoadNetwork`)
- Constructs node topologies with coordinates, customer demands, and time-dependent speed matrices.
- Computes Haversine great-circle distances and realistic urban congestion drag factors.

### 5.2 `feasibility.py` (`FeasibilityEvaluator`)
- Validates CVRP operational constraints:
  1. **Capacity Invariant**: $\sum_{i \in R_k} d_i \le Q \quad \forall k \in \{1, \dots, K\}$
  2. **Customer Visit Invariant**: Each non-depot customer is visited exactly once across all routes.
  3. **Depot Start/End Invariant**: Each vehicle route starts and terminates at depot index 0.
- Implements fast $O(N)$ split delivery preprocessing for over-capacity orders.

### 5.3 `dynamic_state.py`
- Manages real-time incident state machine (`CLEAR` $\rightarrow$ `CONGESTION_ALERT` $\rightarrow$ `REROUTE_CALCULATED` $\rightarrow$ `FLEET_DISPATCHED`).
- Performs warm-restart delta optimization by freezing completed tour segments.

---

## 6. Road Polyline Caching Architecture

To guarantee $<1\text{ ms}$ response times during map interactions and prevent API rate limits:
1. **In-Memory Cache**: Python dictionary keyed by rounded GPS coordinates `lat1,lng1->lat2,lng2`.
2. **Persistent Disk Storage**: `app/road_cache.json` persists road polylines across server restarts.
3. **Dual-Router Fallback**:
   - Primary: Google Directions REST API (step-by-step decoded polylines).
   - Secondary: Open Source Routing Machine (OSRM) driving router (`router.project-osrm.org`).
   - Tertiary: Linear geodesic interpolator (failsafe mode).

---

## 7. Setup & Execution Guide

### Prerequisites
- Python 3.10+
- `pip` package manager

### Installation

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running the API Server

```bash
# Start development server with hot reload on port 8000
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Interactive API Documentation
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

### Running Empirical Benchmarks

```bash
# Execute full multi-scale empirical benchmark suite (Micro to XL)
python run_benchmark.py

# Run component ablation tests
python -m app.algorithms.component_tests
```

---

## 8. Directory Layout

```
backend/
├── app/
│   ├── algorithms/          # 12 Quantum & Classical Optimization Solvers
│   ├── core/                # Graph network, feasibility validator, simulation models
│   ├── dynamic_benchmark.py # Dynamic disturbance benchmark runner
│   ├── empirical_runner.py  # Statistical benchmark test suite
│   ├── main.py              # FastAPI application & endpoint definitions
│   └── road_cache.json      # Pre-cached road polylines for Chennai coordinates
├── empirical_benchmark_summary.json  # Pre-compiled benchmark data across scales
├── requirements.txt         # Python package dependencies
├── run_benchmark.py         # Standalone CLI benchmark executor
└── BACKEND_DOCUMENTATION.md # This technical manual
```
