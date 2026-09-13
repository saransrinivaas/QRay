import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, AlertTriangle, Truck,
  RefreshCw, Navigation, Clock, Route
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline as LeafletPolyline, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

// ---------------------------------------------------------------------------
// 20 Real Chennai Stops
// ---------------------------------------------------------------------------
const INITIAL_LOCATIONS = [
  { id: 0,  name: "Chennai Central Freight Depot", lat: 13.0827, lng: 80.2707, demand: 0,  enabled: true, isDepot: true },
  { id: 1,  name: "Anna Nagar Roundtana",           lat: 13.0850, lng: 80.2101, demand: 12, enabled: true },
  { id: 2,  name: "T. Nagar Panagal Park",           lat: 13.0405, lng: 80.2337, demand: 18, enabled: true },
  { id: 3,  name: "Guindy Industrial Estate",        lat: 13.0067, lng: 80.2026, demand: 25, enabled: true },
  { id: 4,  name: "Velachery Vijaya Nagar",          lat: 12.9759, lng: 80.2212, demand: 15, enabled: true },
  { id: 5,  name: "Koyambedu Wholesale Market",      lat: 13.0694, lng: 80.1948, demand: 30, enabled: true },
  { id: 6,  name: "Porur Toll Junction",             lat: 13.0382, lng: 80.1565, demand: 14, enabled: true },
  { id: 7,  name: "Nungambakkam High Road",          lat: 13.0626, lng: 80.2405, demand: 10, enabled: true },
  { id: 8,  name: "Egmore Station Road",             lat: 13.0732, lng: 80.2609, demand: 16, enabled: true },
  { id: 9,  name: "Perambur Loco Works",             lat: 13.1111, lng: 80.2330, demand: 22, enabled: true },
  { id: 10, name: "Adyar Flyover LB Road",           lat: 13.0012, lng: 80.2565, demand: 15, enabled: true },
  { id: 11, name: "Mylapore Luz Church",             lat: 13.0368, lng: 80.2676, demand: 12, enabled: true },
  { id: 12, name: "Tambaram Sanatorium",             lat: 12.9279, lng: 80.1388, demand: 20, enabled: true },
  { id: 13, name: "Chromepet GST Road",              lat: 12.9516, lng: 80.1462, demand: 18, enabled: true },
  { id: 14, name: "Ashok Pillar Circular",           lat: 13.0336, lng: 80.2114, demand: 14, enabled: true },
  { id: 15, name: "Vadapalani Metro Terminus",       lat: 13.0500, lng: 80.2121, demand: 20, enabled: true },
  { id: 16, name: "Saidapet Bazaar",                 lat: 13.0213, lng: 80.2231, demand: 16, enabled: true },
  { id: 17, name: "Alandur Metro Intermodal",        lat: 13.0039, lng: 80.2015, demand: 15, enabled: true },
  { id: 18, name: "St. Thomas Mount Junction",       lat: 13.0056, lng: 80.1912, demand: 14, enabled: true },
  { id: 19, name: "Kodambakkam Power House",         lat: 13.0519, lng: 80.2255, demand: 12, enabled: true },
  { id: 20, name: "West Mambalam Postal Colony",     lat: 13.0389, lng: 80.2219, demand: 10, enabled: true },
];

const TRUCK_PALETTE = [
  { color: "#ffffff", name: "Alpha" },
  { color: "#38bdf8", name: "Beta"  },
  { color: "#4ade80", name: "Gamma" },
  { color: "#fbbf24", name: "Delta" },
  { color: "#f472b6", name: "Epsilon" },
];

// Fallback if /api/algorithms is unreachable — QALNS is the primary pipeline
const FALLBACK_ALGOS = [
  { key: "qalns", label: "Adaptive Quantum-Guided ALNS+ (Primary)", category: "Quantum-Inspired", is_primary: true },
  { key: "qpso", label: "Quantum-behaved PSO (QPSO)", category: "Quantum-Inspired", is_primary: false },
  { key: "qpso_chaos", label: "QPSO + Chaos/Mutation", category: "Quantum-Inspired", is_primary: false },
  { key: "qga", label: "Quantum-Inspired GA (QGA)", category: "Quantum-Inspired", is_primary: false },
  { key: "qaco", label: "Quantum-Inspired ACO (QACO)", category: "Quantum-Inspired", is_primary: false },
  { key: "qasa", label: "Quantum-Annealing Local Search (QASA)", category: "Quantum-Inspired", is_primary: false },
  { key: "qss", label: "Quantum Solution Swarm (QSS)", category: "Quantum-Inspired", is_primary: false },
  { key: "classical_alns", label: "Classical ALNS (Boltzmann SA Control)", category: "Classical Baseline", is_primary: false },
  { key: "dijkstra_nn", label: "Dijkstra / Nearest Neighbor", category: "Classical Baseline", is_primary: false },
  { key: "clarke_wright", label: "Clarke-Wright Savings", category: "Classical Baseline", is_primary: false },
  { key: "classical_ga", label: "Classical Genetic Algorithm (GA)", category: "Classical Baseline", is_primary: false },
  { key: "classical_aco", label: "Classical Ant Colony Optimization (ACO)", category: "Classical Baseline", is_primary: false },
  { key: "ortools_fast", label: "OR-Tools (Fast / Cheapest Arc)", category: "Industry Benchmark", is_primary: false },
];

// Simulated delivery day window shown on the timeline (8:00 AM to 8:00 PM)
const SIM_START_HOUR = 8;
const SIM_END_HOUR = 20;
const SIM_HOUR_MARKS = Array.from(
  { length: SIM_END_HOUR - SIM_START_HOUR + 1 },
  (_, i) => SIM_START_HOUR + i
);

function formatHourLabel(hour24) {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = ((hour24 + 11) % 12) + 1;
  return `${h12} ${ampm}`;
}

function formatSimClock(progress) {
  const totalMins = (SIM_END_HOUR - SIM_START_HOUR) * 60;
  const mins = Math.min(totalMins, Math.max(0, Math.floor(progress * totalMins)));
  const hour24 = SIM_START_HOUR + Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = ((hour24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Short, algorithm-specific copy for disruption / solve popups */
function algoRerouteCopy(algoKey, displayName) {
  const name = displayName || algoKey;
  const map = {
    qalns: `${name} warm-restart reoptimized the fleet`,
    qpso: `${name} reseeded the quantum swarm and updated routes`,
    qpso_chaos: `${name} applied chaos escape and re-routed`,
    qga: `${name} evolved a new fleet assignment`,
    qaco: `${name} reinforced pheromone trails and re-routed`,
    qasa: `${name} annealed a local re-route`,
    qss: `${name} rebuilt consensus routes from the swarm`,
    classical_alns: `${name} destroyed & repaired neighborhoods`,
    dijkstra_nn: `${name} rebuilt greedy nearest-neighbor paths`,
    clarke_wright: `${name} recomputed savings merges`,
    classical_ga: `${name} evolved a new chromosome solution`,
    classical_aco: `${name} redeposited pheromones and re-routed`,
    ortools_fast: `${name} recomputed a cheapest-arc solution`,
    ortools_gls: `${name} guided local search found a new plan`,
  };
  return map[algoKey] || `${name} recomputed fleet routes`;
}

function algoSolveCopy(algoKey) {
  const map = {
    qalns: `Running primary QALNS+ pipeline…`,
    qpso: `Quantum swarm exploring route space…`,
    qpso_chaos: `QPSO + chaos perturbation in progress…`,
    qga: `Quantum GA rotating qubit angles…`,
    qaco: `QACO updating amplitude pheromones…`,
    qasa: `Quantum annealing local search…`,
    qss: `Quantum solution swarm consensus…`,
    classical_alns: `Classical ALNS neighborhood search…`,
    dijkstra_nn: `Building nearest-neighbor routes…`,
    clarke_wright: `Merging Clarke-Wright savings…`,
    classical_ga: `Evolving GA population…`,
    classical_aco: `Ant colony constructing tours…`,
    ortools_fast: `OR-Tools cheapest-arc solve…`,
    ortools_gls: `OR-Tools guided local search…`,
  };
  return map[algoKey] || `Solving…`;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Continuous smooth vehicle position & heading.
 * Uses exact road-matched coordinates along the vehicle's roadPath.
 */
function getVehiclePositionAndHeading(route, p) {
  const path = route.roadPath;
  if (!path || path.length < 2) return null;
  const clampedP = Math.max(0, Math.min(1, p));
  const f = clampedP * (path.length - 1);

  const i0 = Math.min(Math.floor(f), path.length - 2);
  const i1 = i0 + 1;
  const t = f - i0;
  const lat = path[i0].lat + (path[i1].lat - path[i0].lat) * t;
  const lng = path[i0].lng + (path[i1].lng - path[i0].lng) * t;
  const dLat = path[i1].lat - path[i0].lat;
  const dLng = path[i1].lng - path[i0].lng;
  const heading = Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI);

  return { lat, lng, heading, splitIndex: Math.floor(f) };
}


// ---------------------------------------------------------------------------
// Vehicle icon — pure inline SVG
// ---------------------------------------------------------------------------
function makeVehicleIcon(color, headingDeg = 0, name = '', loadText = '') {
  const s = 32;
  const title = `Vehicle ${name}${loadText ? ` · ${loadText}` : ''}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <circle cx="${s/2}" cy="${s/2}" r="${s/2-1.5}" fill="#0a0a0f" stroke="${color}" stroke-width="2.5"/>
    <polygon points="${s/2},${s*0.18} ${s*0.3},${s*0.8} ${s/2},${s*0.62} ${s*0.7},${s*0.8}"
             fill="${color}" transform="rotate(${headingDeg},${s/2},${s/2})"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: `<div title="${title}" style="cursor:pointer">${svg}</div>`,
    iconSize:   [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

// Stop dot — displays stop number #id (or star for depot) and colored vehicle ring
function makeStopIcon(id, isDepot, isDisrupted = false, assignedColor = null, name = '', demand = 0, vehicleName = '') {
  const size = isDepot ? 24 : 20;
  const half = size / 2;
  let bg  = '#18181b', fg = '#ffffff', bdr = '2px solid #ffffff';
  if (isDepot) {
    bg = '#ffffff'; fg = '#000000'; bdr = '2px solid #000000';
  } else if (isDisrupted) {
    bg = '#7f1d1d'; fg = '#fca5a5'; bdr = '2px solid #ef4444';
  } else if (assignedColor) {
    bg = '#18181b'; fg = '#ffffff'; bdr = `2px solid ${assignedColor}`;
  }
  const title = isDepot
    ? `Depot: ${name || 'Chennai Central Freight Depot'} (#${id})`
    : `Stop #${id}: ${name} (${demand} units)${vehicleName ? ` — Vehicle ${vehicleName}` : ''}${isDisrupted ? ' [DISRUPTED]' : ''}`;

  return L.divIcon({
    className: '',
    html: `<div title="${title}" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${bdr};display:flex;align-items:center;justify-content:center;font-size:${isDepot ? 12 : 9}px;font-weight:800;color:${fg};box-shadow:0 2px 8px rgba(0,0,0,.75);cursor:pointer">${isDepot ? '★' : id}</div>`,
    iconSize:   [size, size],
    iconAnchor: [half, half],
  });
}

// ---------------------------------------------------------------------------
// LocalStorage Persistence Helpers
// ---------------------------------------------------------------------------
function getSavedSetting(key, defaultVal) {
  try {
    const v = localStorage.getItem(`qflock_${key}`);
    return v !== null ? JSON.parse(v) : defaultVal;
  } catch {
    return defaultVal;
  }
}
function setSavedSetting(key, val) {
  try {
    localStorage.setItem(`qflock_${key}`, JSON.stringify(val));
  } catch {}
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function DemoTimelineView() {
  // --- Scenario config ---
  const [locations,     setLocations]     = useState(() => getSavedSetting('locations', INITIAL_LOCATIONS));
  const [numTrucks,     setNumTrucks]     = useState(() => getSavedSetting('numTrucks', 4));
  const [truckCap,      setTruckCap]      = useState(() => getSavedSetting('truckCap', 120));
  const [depotId,       setDepotId]       = useState(() => getSavedSetting('depotId', 0));
  const [selectedAlgo,  setSelectedAlgo]  = useState(() => getSavedSetting('selectedAlgo', 'qalns'));
  const [trafficMode,   setTrafficMode]   = useState(() => getSavedSetting('trafficMode', 'auto')); // 'auto', 'reroute', 'no_turnaround'
  const [algorithms,    setAlgorithms]    = useState(FALLBACK_ALGOS);
  const [sidebarTab,    setSidebarTab]    = useState('config');
  const [showLabels,    setShowLabels]    = useState(false);

  // --- Pre-computed timeline (the core data model) ---
  const [timeline, setTimeline] = useState(null);

  // --- Playback state ---
  const [solving,    setSolving]    = useState(false);
  const [progress,   setProgress]   = useState(0);    // day clock 0–1
  const [pathProg,   setPathProg]   = useState([]);    // per-vehicle 0–1 along own roadPath
  const [playing,    setPlaying]    = useState(false);
  const [speed,      setSpeed]      = useState(1);
  const [disrupted,  setDisrupted]  = useState(false); // has disruption fired this cycle?
  const [scenarioSeed, setScenarioSeed] = useState(42); // deterministic reproducible scenario seed

  // Refs for animation loop access
  const timelineRef   = useRef(null);
  const pathProgRef   = useRef([]);
  const disruptedRef  = useRef(false);
  const playingRef    = useRef(false);
  const progressRef   = useRef(0);

  useEffect(() => { timelineRef.current  = timeline;  }, [timeline]);
  useEffect(() => { pathProgRef.current  = pathProg;   }, [pathProg]);
  useEffect(() => { disruptedRef.current = disrupted;  }, [disrupted]);
  useEffect(() => { playingRef.current   = playing;    }, [playing]);
  useEffect(() => { progressRef.current  = progress;   }, [progress]);

  // Which routes are currently active for rendering
  const activeRoutes = (disrupted && timeline?.reroutedRoutes?.length)
    ? timeline.reroutedRoutes
    : (timeline?.initialRoutes || []);

  // ---------------------------------------------------------------------------
  // Call backend /api/demo/simulate — computes EVERYTHING up front
  // ---------------------------------------------------------------------------
  const runSimulation = useCallback(async (overrides = {}) => {
    const algo = overrides.algo ?? selectedAlgo;
    const locs = overrides.locations ?? locations;
    const trucks = overrides.numTrucks ?? numTrucks;
    const cap = overrides.truckCap ?? truckCap;
    const depot = overrides.depotId ?? depotId;
    const tMode = overrides.trafficMode ?? trafficMode;

    const stops = locs.map(l => ({
      id: l.id, name: l.name, lat: l.lat, lng: l.lng,
      demand: l.demand, enabled: l.enabled, is_depot: l.id === depot,
    }));
    const vehicles = Array.from({ length: trucks }, (_, i) => ({
      id: i, name: TRUCK_PALETTE[i % TRUCK_PALETTE.length].name,
      capacity: cap, color: TRUCK_PALETTE[i % TRUCK_PALETTE.length].color,
    }));

    setSolving(true);
    setDisrupted(false);
    disruptedRef.current = false;

    const curSeed = overrides.seed ?? scenarioSeed;

    try {
      const res = await fetch('/api/demo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stops, 
          vehicles, 
          algo, 
          traffic_mode: tMode,
          seed: curSeed
        }),
      });
      if (!res.ok) throw new Error(`Simulate failed: ${res.status}`);
      const data = await res.json();

      const tl = {
        initialRoutes:  data.initial_routes  || [],
        reroutedRoutes: data.rerouted_routes || [],
        disruption:     data.disruption,
        solveMs:        data.solve_time_ms,
        rerouteMs:      data.reroute_ms,
        totalDistKm:    data.total_dist_km,
        reroutedDistKm: data.rerouted_dist_km,
        algo:           data.algo,
        algoKey:        data.algo_key,
        stopsServed:    data.num_stops_served,
        feasible:       data.feasible,
      };

      setTimeline(tl);
      timelineRef.current = tl;

      // Reset playback
      const routeCount = tl.initialRoutes.length;
      const zeros = new Array(routeCount).fill(0);
      setPathProg(zeros);
      pathProgRef.current = zeros;
      setProgress(0);
      progressRef.current = 0;
      setDisrupted(false);
      disruptedRef.current = false;
      setPlaying(true);
      playingRef.current = true;
    } catch (err) {
      console.error('Simulate error:', err);
    } finally {
      setSolving(false);
    }
  }, [selectedAlgo, locations, numTrucks, truckCap, depotId, trafficMode, scenarioSeed]);

  // ---------------------------------------------------------------------------
  // Config change handlers — each triggers a full re-simulation
  // ---------------------------------------------------------------------------
  const handleShuffleScenario = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 10000) + 1;
    setScenarioSeed(nextSeed);
    runSimulation({ seed: nextSeed });
  }, [runSimulation]);

  const handleAlgoChange = useCallback((val) => {
    setSelectedAlgo(val);
    setSavedSetting('selectedAlgo', val);
    runSimulation({ algo: val });
  }, [runSimulation]);

  const handleTrafficModeChange = useCallback((val) => {
    setTrafficMode(val);
    setSavedSetting('trafficMode', val);
    runSimulation({ trafficMode: val });
  }, [runSimulation]);

  const handleTriggerTrafficAlert = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    const targetP = Math.max(0.06, Math.min(0.85, progressRef.current));
    if (tl.disruption) {
      tl.disruption.time = targetP;
    }
    setProgress(targetP);
    progressRef.current = targetP;
    setDisrupted(true);
    disruptedRef.current = true;
  }, []);

  const handleTrucksChange = useCallback((val) => {
    const n = +val;
    setNumTrucks(n);
    setSavedSetting('numTrucks', n);
    runSimulation({ numTrucks: n });
  }, [runSimulation]);

  const handleCapChange = useCallback((val) => {
    const cap = Math.max(10, +val || 10);
    setTruckCap(cap);
    setSavedSetting('truckCap', cap);
    runSimulation({ truckCap: cap });
  }, [runSimulation]);

  const handleDepotChange = useCallback((val) => {
    const dep = +val;
    const prevDepot = depotId;
    setDepotId(dep);
    setSavedSetting('depotId', dep);
    setLocations(prev => {
      const nextLocs = prev.map(l => {
        if (l.id === dep) return { ...l, isDepot: true, demand: 0 };
        if (l.id === prevDepot || l.isDepot) return { ...l, isDepot: false, demand: l.demand === 0 ? 15 : l.demand };
        return l;
      });
      setSavedSetting('locations', nextLocs);
      runSimulation({ depotId: dep, locations: nextLocs });
      return nextLocs;
    });
  }, [depotId, runSimulation]);

  const handleLocationToggle = useCallback((locId) => {
    setLocations(prev => {
      const nextLocs = prev.map(l => l.id === locId ? { ...l, enabled: !l.enabled } : l);
      setSavedSetting('locations', nextLocs);
      runSimulation({ locations: nextLocs });
      return nextLocs;
    });
  }, [runSimulation]);

  const handleDemandChange = useCallback((locId, val) => {
    const dVal = Math.max(0, +val || 0);
    setLocations(prev => {
      const nextLocs = prev.map(l => l.id === locId ? { ...l, demand: dVal } : l);
      setSavedSetting('locations', nextLocs);
      runSimulation({ locations: nextLocs });
      return nextLocs;
    });
  }, [runSimulation]);

  const handleResetDemands = useCallback(() => {
    setLocations(INITIAL_LOCATIONS);
    setSavedSetting('locations', INITIAL_LOCATIONS);
    runSimulation({ locations: INITIAL_LOCATIONS });
  }, [runSimulation]);

  const handleToggleAll = useCallback((enable) => {
    setLocations(prev => {
      const nextLocs = prev.map(l => l.id === depotId ? l : { ...l, enabled: enable });
      setSavedSetting('locations', nextLocs);
      runSimulation({ locations: nextLocs });
      return nextLocs;
    });
  }, [depotId, runSimulation]);

  // Load algorithm list from backend
  useEffect(() => {
    fetch('/api/algorithms')
      .then(res => res.json())
      .then(data => {
        if (!data || typeof data !== 'object') return;
        const list = Object.entries(data).map(([key, meta]) => ({
          key,
          label: meta.name || key,
          category: meta.category || '',
          is_primary: !!meta.is_primary,
        }));
        if (list.length) setAlgorithms(list);
      })
      .catch(() => {});
  }, []);

  // Initial simulation on mount
  useEffect(() => {
    runSimulation();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Restart — rewind to beginning, restore initial routes
  // ---------------------------------------------------------------------------
  const handleRestart = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) return;
    const count = tl.initialRoutes.length;
    const zeros = new Array(count).fill(0);
    setProgress(0);
    progressRef.current = 0;
    setPathProg(zeros);
    pathProgRef.current = zeros;
    setDisrupted(false);
    disruptedRef.current = false;
    setPlaying(true);
    playingRef.current = true;
  }, []);

  // ---------------------------------------------------------------------------
  // Animation loop — day clock + per-truck path progress
  // Pure playback: reads pre-computed timeline, zero async during animation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const tl = timelineRef.current;
    if (!tl || !tl.initialRoutes.length) return;

    let raf;
    let last = performance.now();

    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      if (playingRef.current) {
        const spd = speed;
        const dayStep = dt * spd * 0.012;

        // Update day progress
        let nextProgress = progressRef.current + dayStep;
        if (nextProgress >= 1) {
          // Loop: restart from beginning
          const count = tl.initialRoutes.length;
          const zeros = new Array(count).fill(0);
          setProgress(0);
          progressRef.current = 0;
          setPathProg(zeros);
          pathProgRef.current = zeros;
          setDisrupted(false);
          disruptedRef.current = false;
          raf = requestAnimationFrame(tick);
          return;
        }

        setProgress(nextProgress);
        progressRef.current = nextProgress;

        // Disruption check
        const disTime = tl.disruption?.time ?? 999;
        const isDis = nextProgress >= disTime && !!tl.disruption;
        if (isDis !== disruptedRef.current) {
          disruptedRef.current = isDis;
          setDisrupted(isDis);
        }

        // Continuous progression along routes (0 to 1)
        const truckP = nextProgress;
        const currentRoutes = (isDis && tl.reroutedRoutes?.length) ? tl.reroutedRoutes : tl.initialRoutes;
        const activeCount = currentRoutes.length;
        const nextProg = new Array(activeCount).fill(truckP);
        setPathProg(nextProg);
        pathProgRef.current = nextProg;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed, timeline]);

  // ---------------------------------------------------------------------------
  // Timeline scrubbing
  // ---------------------------------------------------------------------------
  const scrubTimeline = useCallback((value) => {
    const tl = timelineRef.current;
    if (!tl) return;

    if (value <= 0.005) {
      handleRestart();
      return;
    }

    const disTime = tl.disruption?.time ?? 999;
    const isDis = value >= disTime && !!tl.disruption;
    setDisrupted(isDis);
    disruptedRef.current = isDis;

    const truckP = value;
    const currentRoutes = (isDis && tl.reroutedRoutes?.length) ? tl.reroutedRoutes : tl.initialRoutes;
    const activeCount = currentRoutes.length;
    const arr = new Array(activeCount).fill(truckP);
    setPathProg(arr);
    pathProgRef.current = arr;

    setProgress(value);
    progressRef.current = value;
  }, [handleRestart]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const activeStops  = locations.filter(l => l.enabled && l.id !== depotId);
  const totalDemand  = activeStops.reduce((s, l) => s + l.demand, 0);
  const depot        = locations.find(l => l.id === depotId) || locations[0];
  const algoMeta     = algorithms.find(a => a.key === selectedAlgo);
  const algoLabel    = timeline?.algo || algoMeta?.label || selectedAlgo;
  const clockLabel   = formatSimClock(progress);
  const isPastDisruption = disrupted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Top Bar with Google Maps Navigation Controls ── */}
      <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>QRay Scenario Simulator</span>
          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: '#27272a', color: '#a1a1aa' }}>
            Real Road Routes · {algoLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Traffic Scenario Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#09090b', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 700 }}>Traffic Mode:</span>
            <select
              id="select-traffic-mode"
              value={trafficMode}
              onChange={e => handleTrafficModeChange(e.target.value)}
              style={{
                background: '#27272a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="auto">🔄 Auto-Evaluate (Smart Decision)</option>
              <option value="reroute">⚡ Detour Available (Smaller ETA Reroute)</option>
              <option value="no_turnaround">⚠ No Turnaround (Continue Current Route)</option>
            </select>
          </div>

          <button
            id="btn-shuffle-scenario"
            onClick={handleShuffleScenario}
            title="Randomize traffic disturbance point and generate a new deterministic scenario"
            className="btn-material-outline"
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              background: '#18181b',
              color: '#d4d4d8',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🎲 New Scenario
          </button>

          {/* Immediate Traffic Alert Trigger Button */}
          <button
            id="btn-trigger-traffic"
            onClick={handleTriggerTrafficAlert}
            className="btn-material-outline"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.76rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              borderColor: isPastDisruption ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.2)', 
              color: isPastDisruption ? '#fca5a5' : '#ffffff',
              background: isPastDisruption ? 'rgba(239,68,68,0.15)' : 'transparent'
            }}
            title="Immediately trigger traffic event at current vehicle position"
          >
            <AlertTriangle size={13} style={{ color: '#ef4444' }} />
            {isPastDisruption ? 'Traffic Event Active' : 'Simulate Traffic Alert'}
          </button>

          <button
            onClick={() => runSimulation()}
            disabled={solving}
            className="btn-material-white"
            style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {solving ? <RefreshCw size={14} className="spin" /> : <Navigation size={14} />}
            {solving ? 'Computing…' : 'Run Scenario'}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Map + Metrics + Playback ── */}
        <div className="glass-card" style={{ padding: '6px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '6px', flexShrink: 0 }}>
            {/* Algorithm */}
            <div style={{ background: '#09090b', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Algorithm</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {timeline?.algo ?? '—'}
              </div>
            </div>

            {/* Total Distance */}
            <div style={{ background: '#09090b', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Route size={11} /> Total Distance
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                {timeline?.totalDistKm != null ? `${timeline.totalDistKm} km` : '—'}
              </div>
            </div>

            {/* Initial Solve Time */}
            <div style={{ background: '#09090b', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} /> Initial Solve
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                {timeline?.solveMs != null ? `${timeline.solveMs} ms` : '—'}
              </div>
            </div>

            {/* Reroute Time */}
            <div style={{ background: isPastDisruption ? 'rgba(239,68,68,0.12)' : '#09090b', borderRadius: '8px', padding: '8px 12px', border: isPastDisruption ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s' }}>
              <div style={{ fontSize: '0.68rem', color: isPastDisruption ? '#fca5a5' : '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={11} /> Reroute Time
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isPastDisruption ? '#fca5a5' : '#fff', marginTop: '2px' }}>
                {isPastDisruption ? `${timeline?.rerouteMs ?? '—'} ms` : '—'}
              </div>
              {isPastDisruption && timeline?.disruption && (
                <div style={{ fontSize: '0.65rem', color: '#fca5a5', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ⚡ {timeline.disruption.stop_name} blocked
                </div>
              )}
            </div>
          </div>

          {/* MAP */}
          <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
            <MapContainer
              center={[depot.lat, depot.lng]}
              zoom={12}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', borderRadius: '8px' }}
            >
              <MapRecenter center={[depot.lat, depot.lng]} />
              <TileLayer
                attribution='&copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
              />

              {/* ── Route polylines: completed (dim) + ahead (bright) ── */}
              {activeRoutes.map((route, vIdx) => {
                const path = route.roadPath;
                if (!path || path.length < 2) return null;
                const p = Math.max(0, Math.min(1, pathProg[vIdx] ?? 0));
                const posInfo = getVehiclePositionAndHeading(route, p, route.disruption_time || timeline?.disruption?.time);
                const splitIdx = posInfo ? posInfo.splitIndex : 0;
                const col = route.color || TRUCK_PALETTE[vIdx % TRUCK_PALETTE.length].color;
                const doneSeg = path.slice(0, splitIdx + 1);
                const aheadSeg = path.slice(splitIdx);
                return (
                  <React.Fragment key={`route-${vIdx}-${path.length}`}>
                    {doneSeg.length >= 2 && (
                      <LeafletPolyline
                        positions={doneSeg.map(q => [q.lat, q.lng])}
                        pathOptions={{ color: col, weight: 4, opacity: 0.30 }}
                      />
                    )}
                    {p < 1.0 && aheadSeg.length >= 2 && (
                      <LeafletPolyline
                        positions={aheadSeg.map(q => [q.lat, q.lng])}
                        pathOptions={{ color: col, weight: 6, opacity: 1.0 }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* ── Old canceled/changed route(s) rendered in prominent RED when rerouted ── */}
              {isPastDisruption && (timeline?.disruption?.can_reroute !== false) && (
                timeline?.disruption?.old_canceled_paths?.length > 0 ? (
                  timeline.disruption.old_canceled_paths.map((canceledPath, pIdx) => {
                    if (!canceledPath || canceledPath.length < 2) return null;
                    return (
                      <React.Fragment key={`old-canceled-direct-${pIdx}`}>
                        {/* Glowing wide red underlay */}
                        <LeafletPolyline
                          positions={canceledPath.map(q => [q.lat, q.lng])}
                          pathOptions={{ color: '#ef4444', weight: 10, opacity: 0.45, lineCap: 'round' }}
                        />
                        {/* Bold dashed bright red line representing the canceled old route */}
                        <LeafletPolyline
                          positions={canceledPath.map(q => [q.lat, q.lng])}
                          pathOptions={{
                            color: '#ef4444',
                            weight: 6,
                            opacity: 1.0,
                            dashArray: '8, 12',
                            lineCap: 'round',
                          }}
                        >
                          <LeafletTooltip sticky>
                            <span style={{ fontWeight: 800, color: '#ef4444' }}>
                              Old Route (Canceled Traffic Corridor)
                            </span>
                          </LeafletTooltip>
                        </LeafletPolyline>
                      </React.Fragment>
                    );
                  })
                ) : (
                  timeline?.disruption?.affected_vehicle_indices?.map((vIdx) => {
                    const oldRoute = timeline.initialRoutes?.[vIdx];
                    if (!oldRoute || !oldRoute.roadPath || oldRoute.roadPath.length < 2) return null;
                    const oldPath = oldRoute.roadPath;
                    const disTime = timeline.disruption.time || 0.3;
                    const splitIdx = Math.max(0, Math.min(oldPath.length - 2, Math.floor(disTime * (oldPath.length - 1))));
                    const canceledAheadPath = oldPath.slice(splitIdx);
                    if (canceledAheadPath.length < 2) return null;

                    return (
                      <React.Fragment key={`old-canceled-route-${vIdx}`}>
                        {/* Glowing wide red underlay */}
                        <LeafletPolyline
                          positions={canceledAheadPath.map(q => [q.lat, q.lng])}
                          pathOptions={{ color: '#ef4444', weight: 10, opacity: 0.45, lineCap: 'round' }}
                        />
                        {/* Bold dashed bright red line representing the canceled old route */}
                        <LeafletPolyline
                          positions={canceledAheadPath.map(q => [q.lat, q.lng])}
                          pathOptions={{
                            color: '#ef4444',
                            weight: 6,
                            opacity: 1.0,
                            dashArray: '8, 12',
                            lineCap: 'round',
                          }}
                        >
                          <LeafletTooltip sticky>
                            <span style={{ fontWeight: 800, color: '#ef4444' }}>
                              Old Route (Canceled — {oldRoute.vehicle_name})
                            </span>
                          </LeafletTooltip>
                        </LeafletPolyline>
                      </React.Fragment>
                    );
                  })
                )
              )}

              {/* Blocked road segment(s) causing the disruption */}
              {isPastDisruption && timeline?.disruption?.blocked_segments?.map((seg, sIdx) => {
                if (!seg || seg.length < 2) return null;
                return (
                  <React.Fragment key={`blocked-seg-${sIdx}`}>
                    <LeafletPolyline
                      positions={seg.map(q => [q.lat, q.lng])}
                      pathOptions={{ color: '#b91c1c', weight: 14, opacity: 0.50 }}
                    />
                    <LeafletPolyline
                      positions={seg.map(q => [q.lat, q.lng])}
                      pathOptions={{ color: '#ff0000', weight: 8, opacity: 1.0, dashArray: '4, 8', lineCap: 'round' }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Stop markers */}
              {locations.map(loc => {
                if (!loc.enabled && loc.id !== depotId) return null;
                const isDepot     = loc.id === depotId;
                const isDisrupted = isPastDisruption && !isDepot && (timeline?.disruption?.stop_id === loc.id);
                const assignedTruck = activeRoutes.find(r => r.stops?.some(s => s.id === loc.id && !s.is_depot));
                const assignedColor = assignedTruck?.color || null;
                const vehicleName = assignedTruck?.vehicle_name || '';

                return (
                  <Marker
                    key={`stop-${loc.id}`}
                    position={[loc.lat, loc.lng]}
                    icon={makeStopIcon(loc.id, isDepot, isDisrupted, assignedColor, loc.name, loc.demand, vehicleName)}
                  />
                );
              })}

              {/* Vehicle markers */}
              {activeRoutes.map((route, idx) => {
                const path = route.roadPath;
                if (!path || path.length < 2) return null;
                const p = Math.max(0, Math.min(1, pathProg[idx] ?? 0));
                const posInfo = getVehiclePositionAndHeading(route, p, route.disruption_time || timeline?.disruption?.time);
                if (!posInfo) return null;
                const { lat, lng, heading } = posInfo;
                const col = route.color || TRUCK_PALETTE[idx % TRUCK_PALETTE.length].color;
                const name = route.vehicle_name || TRUCK_PALETTE[idx % TRUCK_PALETTE.length].name;
                const loadText = p >= 1.0 ? 'Parked at Depot (Done)' : `${route.load ?? '?'}/${route.capacity} units`;
                return (
                  <Marker
                    key={`truck-${idx}`}
                    position={[lat, lng]}
                    icon={makeVehicleIcon(col, heading, name, loadText)}
                    zIndexOffset={1000}
                  />
                );
              })}
            </MapContainer>

            {/* ── Live Navigation HUD ── */}
            <div style={{
              position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
              background: isPastDisruption
                ? (timeline?.disruption?.can_reroute !== false ? 'rgba(6, 78, 59, 0.94)' : 'rgba(120, 53, 15, 0.94)')
                : 'rgba(9, 9, 11, 0.90)',
              backdropFilter: 'blur(10px)',
              border: isPastDisruption
                ? (timeline?.disruption?.can_reroute !== false ? '1px solid #10b981' : '1px solid #f59e0b')
                : '1px solid rgba(255,255,255,0.18)',
              borderRadius: '10px', padding: '10px 14px', maxWidth: '380px',
              animation: 'fadeInDown 0.25s ease',
              boxShadow: '0 8px 28px rgba(0,0,0,0.65)'
            }}>
              {!isPastDisruption ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                    <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#ffffff' }}>
                      Fastest Route Active
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#d4d4d8', lineHeight: 1.4 }}>
                    Optimal road tour with {algoLabel}. Traffic clear ahead · All destinations on schedule.
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', fontSize: '0.66rem', color: '#a1a1aa' }}>
                    <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                      Live GPS: Continuous
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                      {activeStops.length} stops scheduled
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    {timeline?.disruption?.can_reroute !== false ? (
                      <Navigation size={16} style={{ color: '#6ee7b7' }} />
                    ) : (
                      <AlertTriangle size={16} style={{ color: '#fde68a' }} />
                    )}
                    <span style={{ 
                      fontSize: '0.82rem', 
                      fontWeight: 900, 
                      color: timeline?.disruption?.can_reroute !== false ? '#6ee7b7' : '#fde68a' 
                    }}>
                      {timeline?.disruption?.can_reroute !== false 
                        ? `⚡ Faster Detour Available (-${timeline?.disruption?.reroute_saved_min || 8} min)`
                        : `⚠ Heavy Traffic Ahead (+${timeline?.disruption?.traffic_delay_min || 16} min)`}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: '#fef2f2', lineHeight: 1.45 }}>
                    {timeline?.disruption?.decision_message || (
                      timeline?.disruption?.can_reroute !== false
                        ? `Traffic on ${timeline.disruption.stop_name}. Rerouted to faster alternative.`
                        : `Traffic ahead on ${timeline.disruption.stop_name}. No turnaround available — continuing current route.`
                    )}
                  </div>

                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                      background: 'rgba(0,0,0,0.4)',
                      color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)'
                    }}>
                      ✓ Continuous Route Progress
                    </span>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                      background: 'rgba(0,0,0,0.4)',
                      color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)'
                    }}>
                      ✓ All {activeStops.length} Stops Delivered
                    </span>
                    {timeline?.disruption?.can_reroute !== false && (
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                        background: 'rgba(0,0,0,0.4)',
                        color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)'
                      }}>
                        Old Path Canceled (Red)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Map Route Legend */}
            {isPastDisruption && (
              <div style={{
                position: 'absolute', bottom: '16px', left: '16px', zIndex: 1000,
                background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px',
                padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '6px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.6)'
              }}>
                {timeline?.disruption?.can_reroute !== false ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '0px', borderTop: '3px dotted #ef4444' }} />
                      <span style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 700 }}>Old Blocked Route (Canceled — Dotted Red)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '22px', height: '5px', background: TRUCK_PALETTE[1].color, borderRadius: '2px' }} />
                      <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>New Rerouted Detour (Vehicle Path)</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '22px', height: '5px', background: '#f59e0b', borderRadius: '2px' }} />
                    <span style={{ fontSize: '0.72rem', color: '#fde68a', fontWeight: 700 }}>Current Route (Continuing Through Congestion)</span>
                  </div>
                )}
              </div>
            )}

            {/* Solving Spinner */}
            {solving && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 1001, background: 'rgba(9,9,11,0.85)', borderRadius: '10px',
                padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '10px',
                animation: 'fadeInDown 0.25s ease'
              }}>
                <RefreshCw size={18} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>
                  {algoSolveCopy(selectedAlgo)}
                </span>
              </div>
            )}
          </div>

          {/* Flowing day timeline (8 AM → 8 PM) */}
          <div style={{
            marginTop: '6px', padding: '10px 14px 8px', background: 'rgba(24,24,27,0.95)',
            borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => setPlaying(p => !p)} className="btn-material-white"
                style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
              </button>
              <button onClick={handleRestart} className="btn-material-outline"
                title="Restart simulation from beginning"
                style={{ width: '30px', height: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SkipBack size={14} />
              </button>

              <div style={{
                flexShrink: 0, minWidth: '78px', padding: '4px 10px', borderRadius: '6px',
                background: '#09090b', border: '1px solid rgba(255,255,255,0.15)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 800,
                color: '#fff', textAlign: 'center', letterSpacing: '0.02em'
              }}>
                {clockLabel}
              </div>

              <div style={{ flex: 1, position: 'relative', paddingTop: '2px', paddingBottom: '18px' }}>
                {/* Track */}
                <div style={{
                  position: 'relative', height: '10px', borderRadius: '999px',
                  background: 'linear-gradient(90deg, #18181b 0%, #27272a 50%, #18181b 100%)',
                  border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden'
                }}>
                  {playing && (
                    <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                      backgroundSize: '40% 100%',
                      animation: 'timelineFlow 2.2s linear infinite'
                    }} />
                  )}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${progress * 100}%`,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.35), #ffffff)',
                    borderRadius: '999px',
                    transition: playing ? 'none' : 'width 0.15s ease-out',
                    boxShadow: '0 0 12px rgba(255,255,255,0.25)'
                  }} />
                </div>
                {/* Playhead */}
                <div style={{
                  position: 'absolute', top: '7px', left: `${progress * 100}%`,
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: '#fff', border: '2px solid #09090b',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 3px rgba(255,255,255,0.15)',
                  pointerEvents: 'none', zIndex: 3,
                  transition: playing ? 'none' : 'left 0.15s ease-out'
                }} />

                {/* Disruption marker on timeline */}
                {timeline?.disruption && (
                  <div style={{
                    position: 'absolute', top: '0px', left: `${(timeline.disruption.time) * 100}%`,
                    width: '3px', height: '10px', background: '#ef4444',
                    transform: 'translateX(-50%)',
                    borderRadius: '1px', zIndex: 2,
                    boxShadow: '0 0 6px rgba(239,68,68,0.6)'
                  }} title={`Disruption at ${formatSimClock(timeline.disruption.time)}`} />
                )}

                {/* Invisible range input for scrubbing */}
                <input
                  type="range" min="0" max="1" step="0.001" value={progress}
                  onChange={e => scrubTimeline(parseFloat(e.target.value))}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: 0, height: '22px',
                    width: '100%', opacity: 0, cursor: 'pointer', margin: 0, zIndex: 2
                  }}
                />

                {/* Hour ticks */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: '14px', height: '16px', pointerEvents: 'none' }}>
                  {SIM_HOUR_MARKS.map(hour => {
                    const frac = (hour - SIM_START_HOUR) / (SIM_END_HOUR - SIM_START_HOUR);
                    const isMajor = hour === SIM_START_HOUR || hour === SIM_END_HOUR || (hour % 2 === 0);
                    return (
                      <div key={hour} style={{
                        position: 'absolute', left: `${frac * 100}%`,
                        transform: 'translateX(-50%)', textAlign: 'center'
                      }}>
                        <div style={{
                          width: '1px', height: isMajor ? '5px' : '3px', margin: '0 auto 2px',
                          background: isMajor ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)'
                        }} />
                        {isMajor && (
                          <span style={{
                            fontSize: '0.60rem', fontWeight: (hour === SIM_START_HOUR || hour === SIM_END_HOUR) ? 700 : 500,
                            color: (hour === SIM_START_HOUR || hour === SIM_END_HOUR) ? '#e4e4e7' : '#a1a1aa',
                            whiteSpace: 'nowrap', letterSpacing: '0.01em'
                          }}>
                            {formatHourLabel(hour)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={speed === s ? 'btn-material-white' : 'btn-material-outline'}
                    style={{ padding: '2px 7px', fontSize: '0.7rem' }}>{s}x</button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '2px', flexShrink: 0 }}>
                {activeRoutes.slice(0, numTrucks).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#fff' }}>
                    <Truck size={12} style={{ color: r.color || '#fff' }} />
                    <span>{TRUCK_PALETTE[i % TRUCK_PALETTE.length].name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Config Drawer ── */}
        <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', margin: 0 }}>Scenario Settings</h3>
                <p style={{ fontSize: '0.70rem', color: '#a1a1aa', margin: '2px 0 0 0' }}>
                  {activeStops.length} stops active · {totalDemand} units demand
                </p>
              </div>
            </div>

            {/* Segmented Tab Switcher */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px',
              background: '#09090b', padding: '3px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0
            }}>
              <button
                onClick={() => setSidebarTab('config')}
                style={{
                  padding: '7px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  background: sidebarTab === 'config' ? '#27272a' : 'transparent',
                  color: sidebarTab === 'config' ? '#ffffff' : '#a1a1aa',
                  transition: 'all 0.15s ease'
                }}
              >
                <Truck size={13} /> Fleet & Controls
              </button>
              <button
                onClick={() => setSidebarTab('demands')}
                style={{
                  padding: '7px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  background: sidebarTab === 'demands' ? '#27272a' : 'transparent',
                  color: sidebarTab === 'demands' ? '#ffffff' : '#a1a1aa',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📋</span> Demands & Stops ({activeStops.length})
              </button>
            </div>

            {sidebarTab === 'config' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
                {/* Algorithm dropdown */}
                <div style={{ background: '#09090b', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <label style={{ fontSize: '0.7rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Algorithm</label>
                  <select
                    value={selectedAlgo}
                    onChange={e => handleAlgoChange(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', background: '#27272a', color: '#fff', fontSize: '0.8rem' }}
                  >
                    {algorithms.map(a => (
                      <option key={a.key} value={a.key}>
                        {a.label}{a.is_primary ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fleet settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#09090b', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Trucks</label>
                    <select value={numTrucks} onChange={e => handleTrucksChange(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', background: '#27272a', color: '#fff', fontSize: '0.8rem' }}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Truck{n>1?'s':''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Capacity / Truck</label>
                    <input type="number" value={truckCap}
                      onChange={e => handleCapChange(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', background: '#27272a', color: '#fff', fontSize: '0.8rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.7rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Depot Location</label>
                    <select value={depotId} onChange={e => handleDepotChange(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', background: '#27272a', color: '#fff', fontSize: '0.8rem' }}>
                      {locations.map(l => <option key={l.id} value={l.id}>#{l.id} — {l.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => runSimulation()}
                    disabled={solving}
                    className="btn-material-white"
                    style={{ width: '100%', padding: '9px', fontSize: '0.80rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {solving ? <RefreshCw size={14} /> : <Navigation size={14} />}
                    {solving ? 'Computing…' : 'Run Scenario'}
                  </button>
                  <button
                    onClick={handleRestart}
                    className="btn-material-outline"
                    style={{
                      width: '100%', padding: '9px', fontSize: '0.80rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      borderColor: 'rgba(255,255,255,0.3)', color: '#fff'
                    }}>
                    <SkipBack size={14} />
                    Restart
                  </button>
                </div>

                {/* Fleet Manifest */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0, marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Truck size={13} style={{ color: '#38bdf8' }} /> Fleet Manifest ({activeRoutes.length > numTrucks ? `${activeRoutes.length} Trips · ${numTrucks} Trucks` : `${activeRoutes.length} Trucks`})
                    </span>
                    <span style={{ fontSize: '0.64rem', color: '#a1a1aa' }}>
                      {isPastDisruption ? (timeline?.disruption?.can_reroute !== false ? 'Rerouted (Detour)' : 'Continuing (Traffic)') : 'Initial Assignment'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeRoutes.map((route, rIdx) => {
                      const col = route.color || TRUCK_PALETTE[rIdx % TRUCK_PALETTE.length].color;
                      const name = route.vehicle_name || TRUCK_PALETTE[rIdx % TRUCK_PALETTE.length].name;
                      const stops = route.stops || [];
                      const p = Math.max(0, Math.min(1, pathProg[rIdx] ?? 0));
                      const currStopIdx = Math.floor(p * Math.max(1, stops.length - 1));
                      const isDone = p >= 1.0;
                      const totalRouteDemand = stops.reduce((s, st) => s + (st.demand || 0), 0);
                      const cap = route.capacity || truckCap;
                      const isAffected = isPastDisruption && timeline?.disruption?.affected_vehicle_indices?.includes(rIdx);

                      return (
                        <div key={`manifest-${rIdx}`} style={{
                          background: '#09090b', borderRadius: '8px',
                          border: isAffected ? '1px solid rgba(239,68,68,0.4)' : `1px solid ${col}33`,
                          padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, boxShadow: `0 0 8px ${col}` }} />
                              <strong style={{ fontSize: '0.78rem', color: '#fff' }}>Vehicle {name}</strong>
                              {isAffected && (
                                <span style={{ 
                                  fontSize: '0.60rem', 
                                  color: timeline?.disruption?.can_reroute !== false ? '#fca5a5' : '#fde68a', 
                                  background: timeline?.disruption?.can_reroute !== false ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', 
                                  padding: '1px 4px', 
                                  borderRadius: '3px' 
                                }}>
                                  {timeline?.disruption?.can_reroute !== false ? 'REROUTED' : 'TRAFFIC CORRIDOR'}
                                </span>
                              )}
                            </div>
                            <span style={{
                              fontSize: '0.66rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                              background: isDone ? 'rgba(74,222,128,0.15)' : 'rgba(56,189,248,0.15)',
                              color: isDone ? '#4ade80' : '#38bdf8'
                            }}>
                              {isDone ? 'Parked at Depot (Done)' : `Stop ${Math.min(currStopIdx + 1, stops.length)}/${stops.length}`}
                            </span>
                          </div>

                          {/* Capacity bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, (totalRouteDemand / cap) * 100)}%`, height: '100%', background: col }} />
                            </div>
                            <span style={{ fontSize: '0.64rem', color: '#a1a1aa' }}>
                              {totalRouteDemand}/{cap}u ({Math.round((totalRouteDemand / cap) * 100)}%)
                            </span>
                          </div>

                          {/* Stops sequence chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                            {stops.map((st, sIdx) => {
                              const isVisited = isDone || sIdx < currStopIdx;
                              const isCurrent = !isDone && sIdx === currStopIdx;
                              const isDepotStop = st.is_depot;
                              const isDisruptedStop = isPastDisruption && (st.id === timeline?.disruption?.stop_id);

                              return (
                                <span key={`seq-${rIdx}-${sIdx}`} style={{
                                  fontSize: '0.66rem', padding: '1px 5px', borderRadius: '4px',
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  background: isDisruptedStop
                                    ? 'rgba(239,68,68,0.2)'
                                    : isCurrent
                                      ? `${col}26`
                                      : isVisited
                                        ? 'rgba(255,255,255,0.06)'
                                        : 'rgba(255,255,255,0.03)',
                                  border: isDisruptedStop
                                    ? '1px solid #ef4444'
                                    : isCurrent
                                      ? `1px solid ${col}`
                                      : '1px solid rgba(255,255,255,0.1)',
                                  color: isDisruptedStop
                                    ? '#fca5a5'
                                    : isVisited
                                      ? '#71717a'
                                      : '#fff',
                                  textDecoration: isVisited && !isDepotStop ? 'line-through' : 'none'
                                }}>
                                  {isVisited && !isDepotStop ? '✓ ' : isCurrent ? '● ' : ''}
                                  {isDepotStop
                                    ? '★ Depot'
                                    : st.split_total > 1
                                      ? `#${st.id} (${st.split_idx}/${st.split_total}: ${st.demand}u)`
                                      : `#${st.id} ${st.name?.split(' ')[0] || ''}`}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Demands & Locations Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#09090b', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>
                    Demand: <strong style={{ color: '#fff' }}>{totalDemand}</strong> / Capacity: <strong style={{ color: '#fff' }}>{numTrucks * truckCap}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={handleResetDemands}
                      style={{ padding: '3px 8px', borderRadius: '4px', background: '#27272a', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem', cursor: 'pointer' }}>
                      Reset
                    </button>
                    <button onClick={() => handleToggleAll(true)}
                      style={{ padding: '3px 8px', borderRadius: '4px', background: '#27272a', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem', cursor: 'pointer' }}>
                      All
                    </button>
                    <button onClick={() => handleToggleAll(false)}
                      style={{ padding: '3px 8px', borderRadius: '4px', background: '#27272a', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.68rem', cursor: 'pointer' }}>
                      None
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#09090b' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#71717a', fontSize: '0.66rem' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '28px' }}>On</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Location</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '70px' }}>Demand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map(loc => {
                        const isDepot = loc.id === depotId;
                        const isDisrupted = isPastDisruption && (timeline?.disruption?.stop_id === loc.id);
                        return (
                          <tr key={`loc-row-${loc.id}`}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: isDisrupted ? 'rgba(239,68,68,0.1)' : isDepot ? 'rgba(255,255,255,0.04)' : 'transparent'
                            }}>
                            <td style={{ padding: '6px 8px' }}>
                              <input type="checkbox"
                                checked={loc.enabled || isDepot}
                                disabled={isDepot}
                                onChange={() => handleLocationToggle(loc.id)}
                                style={{ accentColor: '#fff', cursor: isDepot ? 'default' : 'pointer' }} />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isDepot ? '#fbbf24' : '#fff' }}>
                                  {isDepot ? '★' : `#${loc.id}`}
                                </span>
                                <span style={{ color: isDisrupted ? '#fca5a5' : '#e4e4e7', fontSize: '0.73rem' }}>
                                  {loc.name}
                                  {isDisrupted && ' ⚠'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                              {isDepot ? <span style={{ color: '#71717a' }}>—</span> : (
                                <input type="number" min="0" max="1000" value={loc.demand}
                                  disabled={!loc.enabled}
                                  onChange={e => handleDemandChange(loc.id, e.target.value)}
                                  style={{ width: '54px', padding: '3px 5px', borderRadius: '4px', background: '#18181b', color: '#fff', fontSize: '0.75rem', textAlign: 'right', border: '1px solid rgba(255,255,255,0.15)' }} />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes timelineFlow {
          0% { background-position: -40% 0; }
          100% { background-position: 140% 0; }
        }
      `}
      </style>
    </div>
  );
}
