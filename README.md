# Q-Ray: Quantum-Inspired Fleet Routing & Dynamic Re-Routing Engine

Q-Ray is a high-throughput, latency-optimized Capacitated Vehicle Routing Problem (CVRP) optimization platform. Designed for urban logistics, last-mile dispatch, and dynamic traffic conditions, Q-Ray couples an **Adaptive Large Neighborhood Search with Quantum-Inspired Operators (Q-ALNS+)** with a sub-50ms warm-restart engine for real-time traffic detour recovery.

---

## Executive Summary

| Capability | Q-Ray Q-ALNS+ | Classical Metaheuristics | Industry Standard (OR-Tools) |
| :--- | :--- | :--- | :--- |
| **Initial Solve Latency (15–75 stops)** | **12–35 ms** | 150–850 ms | 45–120 ms (Fast Mode) |
| **Dynamic Re-route Latency** | **18–25 ms** (Warm Restart) | 200–900 ms (Cold Rebuild) | 60–180 ms |
| **Fleet Solution Quality vs Greedy** | **-15% to -21%** distance | -2% to -8% (QPSO / QGA) | Reference Standard |
| **Convergence Speed** | Sub-second convergence | Slow exploration | 60+ seconds (GLS Mode) |
| **Dynamic Map Road Sync** | Google Directions API + Local Cache | Straight-line only | Disconnected solver |

---

## System Architecture

Q-Ray is structured across five decoupled operational layers:

```
+-------------------------------------------------------------------------+
|                  Layer 5: Feasibility & Cost Engine                     |
|        Vectorized NumPy Matrix Evaluation · SDVRP Split Deliveries      |
+-------------------------------------------------------------------------+
                                    ▲
+-------------------------------------------------------------------------+
|             Layer 4: Dynamic Time-Slicing (Live Re-Routing)             |
|     Vehicle State Tracking · Cargo Locking · Relevance Gating Gating     |
+-------------------------------------------------------------------------+
                                    ▲
+-------------------------------------------------------------------------+
|          Layer 2 + 3: Core Optimization Engine (Q-ALNS+ v6)             |
|  5 Destroy Operators · Anchor-Guided Repair · Quantum Detour Wave       |
|  Two-Phase Adaptive k · Rotation Gate · Stagnation Perturbation Restart |
+-------------------------------------------------------------------------+
                                    ▲
+-------------------------------------------------------------------------+
|              Layer 1: Spatial Graph & Distance Ingestion                |
|      Precomputed Haversine / Road Network Distance Cost Matrices        |
+-------------------------------------------------------------------------+
```

### Layer 1: Spatial Graph & Distance Matrix Ingestion
- Precomputes all pairwise network travel times up front into contiguous NumPy arrays.
- Eliminates on-the-fly metric evaluations during iterative neighborhood search.

### Layer 2 & 3: Q-ALNS+ Core Optimization Engine (v6 Specification)
1. **5 Complementary Destroy Operators**:
   - **Random Removal**: Uniform random stop extraction for baseline diversity.
   - **Worst Detour Removal**: Identifies stops creating high marginal detour costs.
   - **Related (Shaw) Removal**: Extracts spatially correlated clusters.
   - **Quantum Detour Wave Dispersion (v6)**: Evaluates detour tension $\theta_s$, mapped through the quantum Born probability amplitude $P(s) \propto \sin^2(\theta_s) + 0.05$ without key-vector conversion overhead in $\mathcal{O}(N)$.
   - **Or-Opt Segment Relocation (v6)**: Extracts contiguous blocks of 1–3 stops to preserve localized spatial cohesion.
2. **Anchor-Guided Priority Greedy Insertion Repair (v6)**:
   - Sorts extracted stops descending by $\text{dist}(\text{depot}, s) \times \left(1 + \frac{\text{demand}[s]}{\text{capacity}}\right)$.
   - Places outlying and heavy stops first to anchor route backbones, avoiding capacity infeasibility traps.
3. **Aggressive Rotation Gate Promotion (v6)**:
   - Dynamic operator trust weights: on success, $w \leftarrow w + 0.15(1.0 - w)$; on non-improvement, gentle decay $w \leftarrow w - 0.02(w - 0.04)$ with a $0.04$ exploration floor.
4. **Two-Phase Adaptive Neighborhood $k$ (v6)**:
   - Uses base destroy fraction for $t/T \le 0.60$, then expands to $k \rightarrow \min(k+2, \lfloor N/2 \rfloor)$ to escape late-stage local attractors.
5. **Quantum Perturbation Restart (v6)**:
   - Fires after $\max(40, 8k)$ consecutive stagnated iterations. Re-shuffles 20% of stops from the historical best solution and resets all operator weights to $0.20$.
6. **Multi-Tier Polishing Pipeline (v6)**:
   - **Intra-Route 2-Opt**: Periodic segment uncrossing every 25 iterations.
   - **Drift Protection**: Verifies cost delta before committing polishing mutations.
   - **Inter-Route Customer Relocation**: Transfers single stops across vehicle route boundaries to break multi-truck clustering deadlocks.
   - **Exit Multi-Pass 2-Opt**: Runs up to 5 complete passes after time budget expiry.

### Layer 4: Dynamic Real-Time Re-Routing
- **Warm-Restart Formulation**: When road blockades or severe congestion occur, the engine hot-starts from the vehicles' instantaneous GPS positions rather than rebuilding from depot.
- **Cargo Invariant Lock**: Undelivered packages currently on board an active vehicle are locked to that specific vehicle, preventing physically impossible in-transit parcel transfers.
- **Relevance Gating**: Scans upcoming route segments in $\mathcal{O}(N)$; re-routing is triggered only for vehicles directly traversing the disrupted corridor.

### Layer 5: Feasibility & Split Delivery (SDVRP)
- **Vectorized Tour Evaluation**: Entire fleet solutions are evaluated using single-pass sliced NumPy lookups, achieving a 4–7x speedup over nested iteration.
- **Split Delivery Preprocessing**: Customer orders exceeding truck capacity are split cleanly into virtual sub-demands visited consecutively without extra tour penalties.

---

## Empirical Benchmarks

All metrics below are verified across repeated empirical trials on standard CVRP benchmark instances.

### Q-Ray vs Google OR-Tools (Time-Matched & Extended)

| Scale | Stop Count | Q-Ray Solve Time | OR-Tools Fast Mode | Quality vs OR-Tools Fast | Quality vs OR-Tools 60s GLS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Micro** | 15 stops | **4.2 ms** | 14.5 ms | **+4.1% better** | Within 1.8% |
| **Small** | 35 stops | **27.2 ms** | 48.0 ms | **+3.9% better** | Within 2.1% |
| **Medium** | 75 stops | **52.4 ms** | 110.0 ms | **+0.2% better** | Within 2.5% |
| **Large** | 150 stops | **148.0 ms** | 340.0 ms | Equivalent (-0.03%) | Within 1.7% |
| **XL** | 300 stops | **385.0 ms** | 920.0 ms | Within 1.7% | Within 3.6% |

### Metaheuristic Ablation Summary

Across extensive controlled experiments, Q-Ray evaluated multiple candidate optimization engines:

```
Greedy Baseline (Dijkstra / NN)  [Floor: 0.0%]
 ├── Classical GA                [-2.1% vs baseline; weak diversity]
 ├── Classical ACO               [+12.4% vs baseline; poor scalability]
 ├── QPSO (Quantum Particle)     [-4.3% vs baseline; slow coordinate convergence]
 ├── QASA (Annealing Local)      [-11.2% vs baseline; fast, but suboptimal cost]
 └── Q-ALNS+ (Chosen Engine)     [-18.6% vs baseline; fastest convergence, modular]
```

### Clarification on "Quantum-Inspired" Mechanics
Q-Ray does not run on physical quantum hardware (QPU). The term *quantum-inspired* denotes algorithms that adapt mathematical concepts from quantum mechanics (such as probability amplitude transformations, Born rule sampling, and tunneling barriers) to classical heuristic optimization.

---

## Repository Structure

```
QRay/
├── backend/
│   ├── app/
│   │   ├── algorithms/               # CVRP Optimization algorithms
│   │   │   ├── qalns.py              # Primary Q-ALNS+ v6 engine
│   │   │   ├── qpso.py               # Quantum Particle Swarm (benchmark)
│   │   │   ├── classical_ga.py       # Genetic Algorithm (benchmark)
│   │   │   ├── classical_aco.py      # Ant Colony Optimization (benchmark)
│   │   │   ├── ortools_solver.py     # Google OR-Tools integration
│   │   │   └── registry.py           # Algorithm registry
│   │   ├── main.py                   # FastAPI application & simulation endpoints
│   │   └── road_cache.json           # Persistent disk cache for Google Directions polylines
│   ├── empirical_benchmark_summary.json
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Main layout & dark stealth design system
│   │   ├── BenchmarkView.jsx         # Verification suite & latency tradeoff view
│   │   ├── DemoTimelineView.jsx      # Live dispatch simulation & detour viewer
│   │   ├── GhostRaceArena.jsx        # Side-by-side algorithm race visualization
│   │   └── index.css                 # Dark stealth theme & layout tokens
│   ├── package.json
│   └── vite.config.js
├── QRay_v6_Implementation_Guide.docx # Comprehensive internal technical specification
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.9+ with pip
- Node.js 18+ with npm

### 1. Backend Setup

```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Run the backend server:
```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
The API documentation is accessible at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Core API Endpoints

### Dynamic Fleet Simulation
- **`POST /api/demo/simulate`**: Solves initial CVRP and computes real-time detour timeline upfront.
  - Returns: `initial_routes`, `rerouted_routes`, `solve_time_ms`, `reroute_ms`, and `road_network_ms`.

### Road Network Geometry
- **`POST /api/demo/road-route`**: Proxy to Google Directions API with disk-backed caching (`road_cache.json`) for zero-latency route polylines.

### Benchmark Suite
- **`GET /api/benchmark`**: Returns empirical benchmark results across Micro, Small, Medium, Large, and XL scales.
- **`POST /api/benchmark/run`**: Executes dynamic on-demand benchmark trials comparing Q-ALNS+ against classical algorithms.

---

## Documentation

For the complete technical specification, pseudocode proofs, mathematical formulations, and historical tuning logs, refer to:
- [`QRay_v6_Implementation_Guide.docx`](./QRay_v6_Implementation_Guide.docx): Full v6 Architecture, Algorithm & Empirical Benchmark Reference Guide.
