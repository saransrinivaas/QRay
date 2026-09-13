"""
QRay Layer 4 Demo: Dynamic Traffic Timeline Simulation Generator
===================================================================
Generates real-time traffic scenarios with warm-restart route optimization
for the interactive timeline demo page.
"""

import time
import numpy as np
from typing import Dict, Any, List
from app.core.graph import RoadNetwork
from app.core.feasibility import FeasibilityEvaluator
from app.algorithms.qpso import QPSOEngine, polish_gbest_routes_2opt

def generate_demo_timeline_data(seed: int = 42) -> Dict[str, Any]:
    np.random.seed(seed)
    
    # 20 stops, 4 vehicles, capacity 100
    num_nodes = 20
    num_vehicles = 4
    capacity = 100.0
    
    network = RoadNetwork(num_nodes=num_nodes, num_vehicles=num_vehicles, vehicle_capacity=capacity, seed=seed)
    evaluator = FeasibilityEvaluator(network.travel_time_matrix, network.demands, capacity)
    
    engine = QPSOEngine(
        road_network=network,
        evaluator=evaluator,
        swarm_size=30,
        alpha=0.7,
        max_iterations=120,
        seed=seed
    )
    engine.initialize_swarm()
    for it in range(120):
        engine.step_vectorized_qpso()
        if it % 15 == 0:
            p_routes, p_cost, was_imp = polish_gbest_routes_2opt(engine.gbest_routes, evaluator, it, 15)
            if was_imp and p_cost < engine.gbest_cost:
                engine.gbest_cost = p_cost
                engine.gbest_routes = p_routes

    # Base initial state
    base_routes = engine.gbest_routes
    base_cost = engine.gbest_cost

    # Node coordinates for SVG map rendering
    coords = {str(k): list(v) for k, v in network.stop_coords.items()}
    demands = {str(k): float(v) for k, v in network.demands.items()}

    # Define timeline events
    timeline_scenarios = [
        {
            "time": "08:00 AM",
            "label": "Morning Departure",
            "incident": "Normal Traffic Flow",
            "severity": "Low",
            "description": "Depot dispatch under clear morning traffic conditions. Optimal initial routes established.",
            "congested_edges": []
        },
        {
            "time": "09:30 AM",
            "label": "North Corridor Bottleneck",
            "incident": "Vehicle Breakdown on Arterial 3-7",
            "severity": "Medium",
            "description": "Arterial road connecting Stop 3 and Stop 7 experienced a breakdown. Congestion delay multiplier set to 3.8x.",
            "congested_edges": [(3, 7, 3.8), (7, 12, 3.2)]
        },
        {
            "time": "11:30 AM",
            "label": "Downtown Gridlock",
            "incident": "Construction Work on Central Avenue",
            "severity": "High",
            "description": "Emergency road repairs near Stop 4 and Stop 9 reduced lane capacity by 75%. Congestion multiplier 4.5x.",
            "congested_edges": [(1, 4, 4.5), (4, 9, 4.2), (9, 14, 3.9)]
        },
        {
            "time": "01:30 PM",
            "label": "Highway Junction Closure",
            "incident": "Multi-Vehicle Accident on Route 8-11",
            "severity": "Critical",
            "description": "Severe accident blocked main highway link between Stop 8 and Stop 11. Congestion multiplier 5.0x.",
            "congested_edges": [(2, 8, 4.8), (8, 11, 5.0), (11, 18, 4.0)]
        },
        {
            "time": "03:30 PM",
            "label": "Evening Commute Surge",
            "incident": "Industrial Zone Shift Traffic",
            "severity": "Medium",
            "description": "Heavy industrial freight traffic near Stop 10 and Stop 16. Congestion multiplier 3.5x.",
            "congested_edges": [(5, 10, 3.5), (10, 16, 3.4), (16, 20, 3.0)]
        },
        {
            "time": "05:00 PM",
            "label": "Traffic Dissipation",
            "incident": "Incident Clear / Normalization",
            "severity": "Low",
            "description": "Roads cleared by traffic authorities. Minor residual delays (1.2x multiplier).",
            "congested_edges": [(8, 11, 1.3), (4, 9, 1.2)]
        }
    ]

    snapshots = []
    current_gbest_position = np.copy(engine.gbest_position)
    current_routes = [list(r) for r in base_routes]

    for step_idx, scenario in enumerate(timeline_scenarios):
        # Apply congestion to graph
        congested_tuples = scenario["congested_edges"]
        
        # Reset edge congestion to 1.0 first then apply new
        for u in network.graph.nodes():
            for v in network.graph.nodes():
                if network.graph.has_edge(u, v):
                    network.graph[u][v]['congestion'] = 1.0

        for u, v, factor in congested_tuples:
            if network.graph.has_edge(u, v):
                network.graph[u][v]['congestion'] = factor

        network.update_travel_time_matrix()
        evaluator.matrix = network.travel_time_matrix

        # Calculate STALE cost (old routes evaluated under updated matrix)
        stale_cost, pure_t, penalty, _ = evaluator.evaluate_routes(current_routes)

        # Execute QPSO Warm-Restart Reroute
        t_start = time.perf_counter()
        
        # Seed particle 0 with fresh NN for new matrix
        new_nn_keys = network.get_vrp_seeded_keys()
        engine.particles[0] = np.clip(new_nn_keys, 0.0, 1.0)
        
        # Keep previous gbest position in particle 1
        if engine.swarm_size > 1:
            engine.particles[1] = np.copy(current_gbest_position)

        # Perturb remaining
        for i in range(2, engine.swarm_size):
            noise = np.random.normal(0.0, 0.10, engine.dimension)
            engine.particles[i] = np.clip(current_gbest_position + noise, 0.0, 1.0)

        engine.stagnant_iterations = 0
        engine.initialize_swarm(seed_heuristic=False)

        # Short dynamic warm-restart search (40 iterations)
        for it in range(40):
            engine.step_vectorized_qpso()
            if it % 10 == 0:
                p_routes, p_cost, was_imp = polish_gbest_routes_2opt(engine.gbest_routes, evaluator, it, 10)
                if was_imp and p_cost < engine.gbest_cost:
                    engine.gbest_cost = p_cost
                    engine.gbest_routes = p_routes

        t_end = time.perf_counter()
        warm_restart_ms = round((t_end - t_start) * 1000, 2)

        rerouted_cost = round(engine.gbest_cost, 2)
        stale_cost = round(stale_cost, 2)
        time_saved = max(0.0, round(stale_cost - rerouted_cost, 2))
        pct_saved = round((time_saved / max(stale_cost, 1.0)) * 100, 1) if stale_cost > rerouted_cost else 0.0

        current_gbest_position = np.copy(engine.gbest_position)
        current_routes = [list(r) for r in engine.gbest_routes]

        # Vehicle load details
        vehicle_details = []
        for v_i, r in enumerate(current_routes):
            route_demand = float(sum(network.demands[node] for node in r))
            vehicle_details.append({
                "vehicle_id": int(v_i + 1),
                "route": [int(node) for node in r],
                "stop_count": int(max(0, len(r) - 2)),
                "total_load": float(route_demand),
                "capacity_pct": float(round((route_demand / capacity) * 100, 1))
            })

        snapshots.append({
            "step_index": int(step_idx),
            "time": str(scenario["time"]),
            "label": str(scenario["label"]),
            "incident": str(scenario["incident"]),
            "severity": str(scenario["severity"]),
            "description": str(scenario["description"]),
            "congested_edges": [{"u": int(u), "v": int(v), "factor": float(f)} for u, v, f in congested_tuples],
            "stale_cost": float(stale_cost),
            "rerouted_cost": float(rerouted_cost),
            "time_saved": float(time_saved),
            "pct_saved": float(pct_saved),
            "warm_restart_ms": float(warm_restart_ms),
            "rerouted_routes": [[int(node) for node in r] for r in current_routes],
            "stale_routes": [[int(node) for node in r] for r in (base_routes if step_idx > 0 else current_routes)],
            "vehicles": vehicle_details
        })

    return {
        "num_nodes": int(num_nodes),
        "num_vehicles": int(num_vehicles),
        "vehicle_capacity": float(capacity),
        "coords": coords,
        "demands": demands,
        "timeline": snapshots
    }


if __name__ == "__main__":
    data = generate_demo_timeline_data()
    print("Demo timeline dataset generated successfully with", len(data["timeline"]), "snapshots.")
