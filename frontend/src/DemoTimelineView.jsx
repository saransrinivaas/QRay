import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, AlertTriangle, Truck,
  RefreshCw, Navigation, Clock, Route, Layers, Sparkles, Zap,
  Download, Eye, EyeOff, MapPin, Gauge, Battery, Activity
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline as LeafletPolyline, Tooltip as LeafletTooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import ESGTelemetryWidget from './ESGTelemetryWidget';
import DisruptionSandboxModal from './DisruptionSandboxModal';
import { playSolveChime, playAlertBuzzer, playClickTick } from './audioUtils';

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

// Map Click to Add Stop Handler
function MapClickHandler({ isAddMode, onAddStop }) {
  useMapEvents({
    click(e) {
      if (!isAddMode) return;
      onAddStop(e.latlng);
    }
  });
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

// Live Traffic Congestion Arterial Ribbons (Chennai Major Corridors)
const CHENNAI_TRAFFIC_CORRIDORS = [
  {
    id: 'anna-salai',
    name: 'Anna Salai / Mount Road Trunk',
    speed: '34 km/h',
    level: 'Moderate',
    color: '#f59e0b',
    path: [
      [13.0827, 80.2707],
      [13.0626, 80.2405],
      [13.0405, 80.2337],
      [13.0213, 80.2231],
      [13.0067, 80.2026]
    ]
  },
  {
    id: 'gst-road',
    name: 'GST Road (Guindy to Tambaram)',
    speed: '18 km/h',
    level: 'Heavy Congestion',
    color: '#ef4444',
    path: [
      [13.0067, 80.2026],
      [13.0039, 80.2015],
      [12.9516, 80.1462],
      [12.9279, 80.1388]
    ]
  },
  {
    id: 'inner-ring',
    name: '100ft Inner Ring Road (Koyambedu-Vadapalani)',
    speed: '14 km/h',
    level: 'Heavy Bottleneck',
    color: '#ef4444',
    path: [
      [13.0694, 80.1948],
      [13.0500, 80.2121],
      [13.0336, 80.2114],
      [13.0039, 80.2015]
    ]
  },
  {
    id: 'omr-it-expressway',
    name: 'Rajiv Gandhi IT Expressway (OMR)',
    speed: '58 km/h',
    level: 'Smooth Flow',
    color: '#10b981',
    path: [
      [13.0012, 80.2565],
      [12.9759, 80.2212],
      [12.9279, 80.2350]
    ]
  },
  {
    id: 'ecr-coast',
    name: 'East Coast Highway (ECR)',
    speed: '64 km/h',
    level: 'Smooth Flow',
    color: '#10b981',
    path: [
      [13.0368, 80.2676],
      [13.0012, 80.2565],
      [12.9150, 80.2580]
    ]
  },
  {
    id: 'poonamallee',
    name: 'Poonamallee High Road Corridor',
    speed: '32 km/h',
    level: 'Moderate Flow',
    color: '#f59e0b',
    path: [
      [13.0827, 80.2707],
      [13.0732, 80.2609],
      [13.0850, 80.2101],
      [13.0382, 80.1565]
    ]
  }
];

// Fallback algorithms
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

export default function DemoTimelineView() {
  const [locations,     setLocations]     = useState(() => getSavedSetting('locations', INITIAL_LOCATIONS));
  const [numTrucks,     setNumTrucks]     = useState(() => getSavedSetting('numTrucks', 4));
  const [truckCap,      setTruckCap]      = useState(() => getSavedSetting('truckCap', 120));
  const [depotId,       setDepotId]       = useState(() => getSavedSetting('depotId', 0));
  const [selectedAlgo,  setSelectedAlgo]  = useState(() => getSavedSetting('selectedAlgo', 'qalns'));
  const [trafficMode,   setTrafficMode]   = useState(() => getSavedSetting('trafficMode', 'auto'));
  const [algorithms,    setAlgorithms]    = useState(FALLBACK_ALGOS);
  const [sidebarTab,    setSidebarTab]    = useState('config');
  const [is3DView,      setIs3DView]      = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [customDisruption, setCustomDisruption] = useState(null);

  // New Interactive States
  const [focusedVehicleId, setFocusedVehicleId] = useState(null); // null = all, or 0, 1, 2...
  const [showTrafficRibbons, setShowTrafficRibbons] = useState(true);
  const [isAddStopMode, setIsAddStopMode] = useState(false);
  const [selectedVehicleHUD, setSelectedVehicleHUD] = useState(null); // HUD for inspected vehicle
  const [activePreset, setActivePreset] = useState('standard');

  const [timeline, setTimeline] = useState(null);
  const [solving,    setSolving]    = useState(false);
  const [statPulse,  setStatPulse]  = useState(false);
  const [displayDist, setDisplayDist] = useState(null);
  const [displaySolve, setDisplaySolve] = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [pathProg,   setPathProg]   = useState([]);
  const [playing,    setPlaying]    = useState(false);
  const [speed,      setSpeed]      = useState(1);
  const [disrupted,  setDisrupted]  = useState(false);
  const [scenarioSeed, setScenarioSeed] = useState(42);

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

  const activeRoutes = (disrupted && timeline?.reroutedRoutes?.length)
    ? timeline.reroutedRoutes
    : (timeline?.initialRoutes || []);

  const animateCountUp = useCallback((targetDist, targetSolve) => {
    const startTime = performance.now();
    const duration = 900;
    const startD = 0;
    const startS = 0;

    const step = (now) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - p, 3);

      setDisplayDist(+(startD + (targetDist - startD) * ease).toFixed(1));
      setDisplaySolve(+(startS + (targetSolve - startS) * ease).toFixed(1));

      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayDist(targetDist);
        setDisplaySolve(targetSolve);
        setTimeout(() => setStatPulse(false), 200);
      }
    };
    requestAnimationFrame(step);
  }, []);

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
    setStatPulse(true);
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

      animateCountUp(tl.totalDistKm || 48.5, tl.solveMs || 38.4);
      playSolveChime();

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
      animateCountUp(48.5, 38.4);
    } finally {
      setSolving(false);
    }
  }, [selectedAlgo, locations, numTrucks, truckCap, depotId, trafficMode, scenarioSeed, animateCountUp]);

  // Handle Preset Changes
  const handleApplyPreset = (presetKey) => {
    playClickTick();
    setActivePreset(presetKey);
    let updatedLocs = INITIAL_LOCATIONS.map(l => ({ ...l, enabled: true }));
    let updatedTrucks = numTrucks;
    let updatedCap = truckCap;

    if (presetKey === 'flood') {
      // Guindy and Velachery flooded
      updatedLocs = updatedLocs.map(l => {
        if (l.id === 3 || l.id === 4) return { ...l, enabled: false };
        return l;
      });
      playAlertBuzzer();
    } else if (presetKey === 'kathipara') {
      // High demand on south corridor
      updatedLocs = updatedLocs.map(l => {
        if ([17, 18, 3].includes(l.id)) return { ...l, demand: l.demand * 2 };
        return l;
      });
    } else if (presetKey === 'medical') {
      // High medical cargo in core hospitals
      updatedLocs = updatedLocs.map(l => {
        if ([2, 7, 8].includes(l.id)) return { ...l, demand: 45 };
        return l;
      });
    } else if (presetKey === 'ev_green') {
      // 5 light electric vans with 70 unit limits
      updatedTrucks = 5;
      updatedCap = 70;
      setNumTrucks(5);
      setTruckCap(70);
    }

    setLocations(updatedLocs);
    runSimulation({ locations: updatedLocs, numTrucks: updatedTrucks, truckCap: updatedCap });
  };

  // Click to Add Stop Handler
  const handleAddStopAtCoord = (latlng) => {
    playClickTick();
    const newId = locations.length;
    const newStop = {
      id: newId,
      name: `Dynamic Stop #${newId}`,
      lat: +latlng.lat.toFixed(5),
      lng: +latlng.lng.toFixed(5),
      demand: 15,
      enabled: true
    };
    const nextLocs = [...locations, newStop];
    setLocations(nextLocs);
    setSavedSetting('locations', nextLocs);
    setIsAddStopMode(false);
    runSimulation({ locations: nextLocs });
  };

  // Export Manifest CSV
  const exportManifestCSV = () => {
    playClickTick();
    let csv = "Vehicle,Stop Sequence,Stop ID,Stop Name,Latitude,Longitude,Demand (Units),Cumulative Route Load\n";
    activeRoutes.forEach((route, vIdx) => {
      const vName = route.vehicle_name || `Truck ${vIdx + 1}`;
      let cumLoad = 0;
      (route.stops || []).forEach((st, sIdx) => {
        cumLoad += (st.demand || 0);
        csv += `"${vName}",${sIdx + 1},${st.id},"${st.name || ''}",${st.lat},${st.lng},${st.demand || 0},${cumLoad}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `qray_fleet_manifest_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Hotkey custom events listener from App.jsx
  useEffect(() => {
    const onHotkey = (e) => {
      const action = e.detail;
      if (action === 'toggle-play') {
        setPlaying(p => !p);
        playClickTick();
      } else if (action === 'restart') {
        handleRestart();
      } else if (action === 'toggle-traffic') {
        handleToggleTrafficAlert();
      } else if (action === 'open-sandbox') {
        setIsSandboxOpen(true);
        playClickTick();
      }
    };
    window.addEventListener('qray-hotkey', onHotkey);
    return () => window.removeEventListener('qray-hotkey', onHotkey);
  }, []);

  const handleShuffleScenario = useCallback(() => {
    playClickTick();
    const nextSeed = Math.floor(Math.random() * 10000) + 1;
    setScenarioSeed(nextSeed);
    runSimulation({ seed: nextSeed });
  }, [runSimulation]);

  const handleAlgoChange = useCallback((val) => {
    playClickTick();
    setSelectedAlgo(val);
    setSavedSetting('selectedAlgo', val);
    runSimulation({ algo: val });
  }, [runSimulation]);

  const handleTrafficModeChange = useCallback((val) => {
    playClickTick();
    setTrafficMode(val);
    setSavedSetting('trafficMode', val);
    runSimulation({ trafficMode: val });
  }, [runSimulation]);

  const handleToggleTrafficAlert = useCallback(() => {
    if (disrupted) {
      setDisrupted(false);
      disruptedRef.current = false;
      playClickTick();
    } else {
      playAlertBuzzer();
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
    }
  }, [disrupted]);

  const handleSandboxApply = useCallback((disruptionObj) => {
    playAlertBuzzer();
    setCustomDisruption(disruptionObj);
    const tl = timelineRef.current;
    if (tl) {
      const targetP = Math.max(0.08, Math.min(0.85, progressRef.current));
      if (!tl.disruption) tl.disruption = {};
      tl.disruption.stop_id = disruptionObj.stopId;
      tl.disruption.stop_name = `${disruptionObj.typeInfo?.title || 'Disruption'} at ${disruptionObj.stopName}`;
      tl.disruption.time = targetP;
      tl.disruption.reroute_saved_min = 9.2;
      tl.disruption.decision_message = `${disruptionObj.typeInfo?.title || 'Incident'} active at ${disruptionObj.stopName}. QRay warm-restart dynamically evaluated road bottlenecks and rerouted active fleet.`;
      setProgress(targetP);
      progressRef.current = targetP;
      setDisrupted(true);
      disruptedRef.current = true;
    }
  }, []);

  const handleSandboxClear = useCallback(() => {
    playClickTick();
    setCustomDisruption(null);
    setDisrupted(false);
    disruptedRef.current = false;
  }, []);

  const handleRestart = useCallback(() => {
    playClickTick();
    const tl = timelineRef.current;
    const count = tl?.initialRoutes?.length || numTrucks;
    const zeros = new Array(count).fill(0);
    setPathProg(zeros);
    pathProgRef.current = zeros;
    setProgress(0);
    progressRef.current = 0;
    setDisrupted(false);
    disruptedRef.current = false;
    setPlaying(true);
    playingRef.current = true;
  }, [numTrucks]);

  const handleTrucksChange = useCallback((val) => {
    playClickTick();
    const n = parseInt(val, 10);
    setNumTrucks(n);
    setSavedSetting('numTrucks', n);
    runSimulation({ numTrucks: n });
  }, [runSimulation]);

  const handleCapChange = useCallback((val) => {
    const c = parseInt(val, 10) || 120;
    setTruckCap(c);
    setSavedSetting('truckCap', c);
    runSimulation({ truckCap: c });
  }, [runSimulation]);

  const handleDepotChange = useCallback((val) => {
    playClickTick();
    const d = parseInt(val, 10);
    setDepotId(d);
    setSavedSetting('depotId', d);
    runSimulation({ depotId: d });
  }, [runSimulation]);

  const handleLocationToggle = useCallback((id) => {
    playClickTick();
    setLocations(prev => {
      const next = prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l);
      setSavedSetting('locations', next);
      runSimulation({ locations: next });
      return next;
    });
  }, [runSimulation]);

  const handleDemandChange = useCallback((id, val) => {
    const d = Math.max(0, parseInt(val, 10) || 0);
    setLocations(prev => {
      const next = prev.map(l => l.id === id ? { ...l, demand: d } : l);
      setSavedSetting('locations', next);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((enable) => {
    playClickTick();
    setLocations(prev => {
      const next = prev.map(l => l.id === depotId ? l : { ...l, enabled: enable });
      setSavedSetting('locations', next);
      runSimulation({ locations: next });
      return next;
    });
  }, [depotId, runSimulation]);

  const handleResetDemands = useCallback(() => {
    playClickTick();
    setLocations(INITIAL_LOCATIONS);
    setSavedSetting('locations', INITIAL_LOCATIONS);
    runSimulation({ locations: INITIAL_LOCATIONS });
  }, [runSimulation]);

  useEffect(() => {
    fetch('/api/algorithms')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setAlgorithms(data); })
      .catch(() => {});
    runSimulation();
  }, []);

  // Animation frame loop
  useEffect(() => {
    let raf = null;
    let lastTime = null;

    const tick = (now) => {
      if (!lastTime) lastTime = now;
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (playingRef.current) {
        const simSpeed = 0.04 * speed;
        const nextProgress = Math.min(1.0, progressRef.current + dt * simSpeed);
        setProgress(nextProgress);
        progressRef.current = nextProgress;

        if (nextProgress >= 1.0) {
          setPlaying(false);
          playingRef.current = false;
        }

        const tl = timelineRef.current;
        const disTime = tl?.disruption?.time ?? 999;
        const isDis = nextProgress >= disTime && !!tl?.disruption;

        if (isDis !== disruptedRef.current) {
          setDisrupted(isDis);
          disruptedRef.current = isDis;
          if (isDis) playAlertBuzzer();
        }

        const truckP = nextProgress;
        const currentRoutes = (isDis && tl?.reroutedRoutes?.length) ? tl.reroutedRoutes : (tl?.initialRoutes || []);
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

  const activeStops  = locations.filter(l => l.enabled && l.id !== depotId);
  const totalDemand  = activeStops.reduce((s, l) => s + l.demand, 0);
  const depot        = locations.find(l => l.id === depotId) || locations[0];
  const algoMeta     = algorithms.find(a => a.key === selectedAlgo);
  const algoLabel    = timeline?.algo || algoMeta?.label || selectedAlgo;
  const isPastDisruption = disrupted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Top Bar Controls ── */}
      <div className="glass-card scenario-card-hairline stagger-enter-2" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
            QRay Scenario Simulator
          </span>
          <span style={{ 
            fontSize: '0.68rem', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            background: 'rgba(90, 106, 245, 0.12)', 
            color: 'var(--indigo)', 
            border: '1px solid rgba(90, 106, 245, 0.28)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600
          }}>
            Real Road Routes · {algoLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Traffic Scenario Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--panel-2)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>Traffic Mode:</span>
            <select
              id="select-traffic-mode"
              value={trafficMode}
              onChange={e => handleTrafficModeChange(e.target.value)}
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="auto">Auto-Evaluate (Policy Optimized)</option>
              <option value="reroute">Detour Available (Dynamic Reroute Active)</option>
              <option value="no_turnaround">No Turnaround (Sustain Scheduled Route)</option>
            </select>
          </div>

          {/* Traffic Flow Ribbon Layer Toggle */}
          <button
            id="btn-toggle-traffic-ribbons"
            onClick={() => { setShowTrafficRibbons(v => !v); playClickTick(); }}
            className="btn-quantum-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              background: showTrafficRibbons ? 'rgba(43, 201, 216, 0.15)' : 'rgba(10, 16, 36, 0.55)',
              color: showTrafficRibbons ? 'var(--cyan)' : 'var(--text-dim)',
              borderColor: showTrafficRibbons ? 'var(--cyan)' : 'var(--border)',
              cursor: 'pointer'
            }}
            title="Toggle Live Arterial Traffic Flow Ribbons on Chennai Map"
          >
            {showTrafficRibbons ? <Eye size={13} /> : <EyeOff size={13} />}
            Traffic Flow {showTrafficRibbons ? 'ON' : 'OFF'}
          </button>

          {/* Click to Add Stop Mode Button */}
          <button
            id="btn-toggle-add-stop"
            onClick={() => { setIsAddStopMode(v => !v); playClickTick(); }}
            className="btn-quantum-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              background: isAddStopMode ? 'rgba(251, 191, 36, 0.22)' : 'rgba(10, 16, 36, 0.55)',
              color: isAddStopMode ? '#fbbf24' : 'var(--text-dim)',
              borderColor: isAddStopMode ? '#fbbf24' : 'var(--border)',
              cursor: 'pointer'
            }}
            title="Click anywhere on the map to drop a new delivery stop"
          >
            <MapPin size={13} />
            {isAddStopMode ? 'Click Map to Place Stop' : '+ Add Stop'}
          </button>

          <button
            id="btn-shuffle-scenario"
            onClick={handleShuffleScenario}
            title="Randomize traffic disturbance point and generate a new deterministic scenario"
            className="btn-quantum-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🎲 New Scenario
          </button>

          {/* 2.5D Isometric Tilt View Toggle */}
          <button
            id="btn-toggle-3d"
            onClick={() => { setIs3DView(v => !v); playClickTick(); }}
            className="btn-quantum-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              background: is3DView ? 'rgba(90, 106, 245, 0.22)' : 'rgba(10, 16, 36, 0.55)',
              color: is3DView ? 'var(--indigo)' : 'var(--text-dim)',
              borderColor: is3DView ? 'var(--indigo)' : 'var(--border)',
              cursor: 'pointer'
            }}
            title="Toggle 2.5D Isometric Tilt Perspective on Road Map"
          >
            <Layers size={13} style={{ color: is3DView ? 'var(--indigo)' : 'var(--text-dim)' }} />
            {is3DView ? '3D Tilt ON' : '2D Map'}
          </button>

          {/* Chaos God Mode Sandbox Button */}
          <button
            id="btn-open-sandbox"
            onClick={() => { setIsSandboxOpen(true); playClickTick(); }}
            className="btn-quantum-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(122, 90, 240, 0.18) 0%, rgba(90, 106, 245, 0.25) 100%)',
              color: 'var(--violet)',
              border: '1px solid rgba(122, 90, 240, 0.4)',
              cursor: 'pointer'
            }}
            title="Open Interactive Disruption Sandbox (Floods, Roadblocks, VIP Corridors)"
          >
            <Zap size={13} style={{ color: 'var(--violet)' }} />
            Disruption Sandbox
          </button>

          {/* Traffic Alert Trigger */}
          <button
            id="btn-trigger-traffic"
            onClick={handleToggleTrafficAlert}
            className="btn-quantum-secondary"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.76rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              borderColor: isPastDisruption ? 'rgba(239,68,68,0.7)' : 'var(--border)', 
              color: isPastDisruption ? '#fca5a5' : 'var(--text)',
              background: isPastDisruption ? 'rgba(239,68,68,0.18)' : 'rgba(10, 16, 36, 0.55)',
              boxShadow: isPastDisruption ? '0 0 14px rgba(239,68,68,0.25)' : 'none'
            }}
            title="Toggle simulated traffic incident on active fleet corridor"
          >
            <AlertTriangle size={13} style={{ color: isPastDisruption ? '#ef4444' : 'var(--text-dim)' }} />
            {isPastDisruption ? 'Traffic Alert Active (Simulated)' : 'Simulate Traffic Alert'}
          </button>

          <button
            onClick={() => runSimulation()}
            disabled={solving}
            className="btn-quantum-primary"
            style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {solving ? <RefreshCw size={14} className="spin" /> : <Navigation size={14} />}
            {solving ? 'Solving…' : 'Run Scenario'}
          </button>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="stagger-enter-4" style={{ display: 'grid', gridTemplateColumns: '1fr 370px', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Map + Metrics + Playback ── */}
        <div className="glass-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

          {/* Metrics Row (Stat Tiles with Left Accent Bar + Mini Sparklines) */}
          <div className="stagger-enter-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px', flexShrink: 0 }}>
            {/* Algorithm */}
            <div className={`stat-tile-accent ${statPulse ? 'stat-tile-solving' : ''}`} style={{ padding: '8px 12px 8px 14px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 500 }}>Algorithm Engine</div>
              <div style={{ fontSize: '1.10rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-heading)' }}>
                {timeline?.algo ?? '—'}
              </div>
            </div>

            {/* Total Distance + Sparkline */}
            <div className={`stat-tile-accent ${statPulse ? 'stat-tile-solving' : ''}`} style={{ padding: '8px 12px 8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Route size={12} style={{ color: 'var(--indigo)' }} /> Total distance
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px', fontFamily: 'var(--font-heading)' }}>
                  {displayDist != null ? `${displayDist} km` : timeline?.totalDistKm != null ? `${timeline.totalDistKm} km` : '—'}
                </div>
              </div>
              {/* Mini Convergence Sparkline */}
              <svg width="44" height="20" style={{ overflow: 'visible', opacity: 0.85 }}>
                <path d="M0 16 Q12 12, 22 6 T44 2" fill="none" stroke="var(--cyan)" strokeWidth="2" />
                <circle cx="44" cy="2" r="3" fill="var(--cyan)" />
              </svg>
            </div>

            {/* Initial Solve Time + Sparkline */}
            <div className={`stat-tile-accent ${statPulse ? 'stat-tile-solving' : ''}`} style={{ padding: '8px 12px 8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} style={{ color: 'var(--indigo)' }} /> Initial solve
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px', fontFamily: 'var(--font-heading)' }}>
                  {displaySolve != null ? `${displaySolve} ms` : timeline?.solveMs != null ? `${timeline.solveMs} ms` : '—'}
                </div>
              </div>
              {/* Mini Convergence Sparkline */}
              <svg width="44" height="20" style={{ overflow: 'visible', opacity: 0.85 }}>
                <path d="M0 18 Q8 2, 20 5 T44 1" fill="none" stroke="var(--indigo)" strokeWidth="2" />
                <circle cx="44" cy="1" r="3" fill="var(--indigo)" />
              </svg>
            </div>

            {/* Reroute Time */}
            <div className={`stat-tile-accent ${statPulse ? 'stat-tile-solving' : ''}`} style={{
              padding: '8px 12px 8px 14px',
              background: isPastDisruption ? 'rgba(239,68,68,0.08)' : 'var(--panel-2)',
              borderColor: isPastDisruption ? 'rgba(239,68,68,0.35)' : 'var(--border)'
            }}>
              <div style={{ fontSize: '0.68rem', color: isPastDisruption ? '#fca5a5' : 'var(--text-faint)', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} style={{ color: isPastDisruption ? '#ef4444' : 'var(--text-dim)' }} /> Reroute time
                </span>
                {isPastDisruption && (
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>warm restart</span>
                )}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 600, color: isPastDisruption ? '#fca5a5' : 'var(--text)', marginTop: '2px', fontFamily: 'var(--font-heading)' }}>
                {isPastDisruption ? `${timeline?.rerouteMs ?? '—'} ms` : '—'}
              </div>
            </div>
          </div>

          {/* ESG Telemetry Widget */}
          <div style={{ marginBottom: '8px', flexShrink: 0 }}>
            <ESGTelemetryWidget
              totalDistKm={timeline?.totalDistKm || 48.5}
              baselineDistKm={56.4}
              numVehicles={numTrucks}
              isDisrupted={isPastDisruption}
            />
          </div>

          {/* MAP */}
          <div style={{
            flex: 1,
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            perspective: is3DView ? '1200px' : 'none',
            transition: 'perspective 0.4s ease',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              transform: is3DView ? 'rotateX(20deg) scale(1.02)' : 'none',
              transformOrigin: '50% 60%',
              transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: is3DView ? '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(90,106,245,0.2)' : 'none'
            }}>
            <MapContainer
              center={[depot.lat, depot.lng]}
              zoom={12}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', borderRadius: '12px', cursor: isAddStopMode ? 'crosshair' : 'default' }}
            >
              <MapRecenter center={[depot.lat, depot.lng]} />
              <MapClickHandler isAddMode={isAddStopMode} onAddStop={handleAddStopAtCoord} />

              <TileLayer
                attribution='&copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
              />

              {/* ── Live Chennai Traffic Congestion Ribbons Layer ── */}
              {showTrafficRibbons && CHENNAI_TRAFFIC_CORRIDORS.map(corridor => (
                <LeafletPolyline
                  key={`corridor-${corridor.id}`}
                  positions={corridor.path}
                  pathOptions={{
                    color: corridor.color,
                    weight: 5,
                    opacity: 0.55,
                    dashArray: corridor.level.includes('Heavy') ? '6, 8' : undefined
                  }}
                >
                  <LeafletTooltip sticky>
                    <div style={{ fontSize: '0.72rem', padding: '3px 6px', background: 'var(--panel-2)', color: 'var(--text)', borderRadius: '6px' }}>
                      <strong style={{ color: corridor.color }}>{corridor.name}</strong><br />
                      Speed: {corridor.speed} · {corridor.level}
                    </div>
                  </LeafletTooltip>
                </LeafletPolyline>
              ))}

              {/* ── Route polylines (with Fleet Solo Focus Filtering) ── */}
              {activeRoutes.map((route, vIdx) => {
                const path = route.roadPath;
                if (!path || path.length < 2) return null;
                const p = Math.max(0, Math.min(1, pathProg[vIdx] ?? 0));
                const posInfo = getVehiclePositionAndHeading(route, p);
                const splitIdx = posInfo ? posInfo.splitIndex : 0;
                const col = route.color || TRUCK_PALETTE[vIdx % TRUCK_PALETTE.length].color;
                const doneSeg = path.slice(0, splitIdx + 1);
                const aheadSeg = path.slice(splitIdx);

                // Fleet Solo Focus Mode Logic
                const isSoloFocused = focusedVehicleId === vIdx;
                const isDimmed = focusedVehicleId !== null && !isSoloFocused;
                const weightDone = isSoloFocused ? 6 : isDimmed ? 2 : 4;
                const weightAhead = isSoloFocused ? 8 : isDimmed ? 2.5 : 6;
                const opacityDone = isDimmed ? 0.10 : 0.30;
                const opacityAhead = isDimmed ? 0.18 : 1.0;

                return (
                  <React.Fragment key={`route-${vIdx}-${path.length}`}>
                    {doneSeg.length >= 2 && (
                      <LeafletPolyline
                        positions={doneSeg.map(q => [q.lat, q.lng])}
                        pathOptions={{ color: col, weight: weightDone, opacity: opacityDone }}
                      />
                    )}
                    {p < 1.0 && aheadSeg.length >= 2 && (
                      <LeafletPolyline
                        positions={aheadSeg.map(q => [q.lat, q.lng])}
                        pathOptions={{ color: col, weight: weightAhead, opacity: opacityAhead }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Old canceled/changed route(s) in RED when rerouted */}
              {isPastDisruption && (timeline?.disruption?.can_reroute !== false) && (
                timeline?.disruption?.old_canceled_paths?.length > 0 ? (
                  timeline.disruption.old_canceled_paths.map((canceledPath, pIdx) => {
                    if (!canceledPath || canceledPath.length < 2) return null;
                    return (
                      <React.Fragment key={`old-canceled-direct-${pIdx}`}>
                        <LeafletPolyline
                          positions={canceledPath.map(q => [q.lat, q.lng])}
                          pathOptions={{ color: '#ef4444', weight: 10, opacity: 0.45, lineCap: 'round' }}
                        />
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
                ) : null
              )}

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
                  >
                    <LeafletTooltip
                      direction="top"
                      offset={[0, -12]}
                      opacity={0.96}
                      className="custom-map-tooltip"
                    >
                      <div style={{
                        padding: '5px 9px',
                        background: 'var(--panel-2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '0.74rem',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 600,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.6)'
                      }}>
                        <div style={{ color: isDepot ? 'var(--indigo)' : 'var(--text)' }}>
                          {isDepot ? '★ Central Freight Depot' : `#${loc.id} · ${loc.name}`}
                        </div>
                        {!isDepot && (
                          <div style={{ color: 'var(--cyan)', fontSize: '0.68rem', fontWeight: 500, marginTop: '2px' }}>
                            Demand: {loc.demand} units {vehicleName ? `· Truck ${vehicleName}` : ''}
                          </div>
                        )}
                      </div>
                    </LeafletTooltip>
                  </Marker>
                );
              })}

              {/* Vehicle markers with click-to-open Telemetry HUD */}
              {activeRoutes.map((route, idx) => {
                const path = route.roadPath;
                if (!path || path.length < 2) return null;
                const p = Math.max(0, Math.min(1, pathProg[idx] ?? 0));
                const posInfo = getVehiclePositionAndHeading(route, p);
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
                    eventHandlers={{
                      click: () => {
                        playClickTick();
                        setSelectedVehicleHUD({ route, idx, p, posInfo });
                        setFocusedVehicleId(idx);
                      }
                    }}
                  />
                );
              })}
            </MapContainer>

            {/* ── Live Navigation HUD Toast ── */}
            <div style={{
              position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
              background: isPastDisruption
                ? (timeline?.disruption?.can_reroute !== false ? 'rgba(8, 16, 36, 0.92)' : 'rgba(32, 16, 12, 0.92)')
                : 'var(--panel-glass)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: isPastDisruption
                ? (timeline?.disruption?.can_reroute !== false ? '1px solid var(--cyan)' : '1px solid #f59e0b')
                : '1px solid var(--border)',
              borderRadius: '14px', padding: '10px 14px', maxWidth: '380px',
              animation: 'fadeInDown 0.25s ease',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
            }}>
              {!isPastDisruption ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span className="live-beacon live-indicator-slow" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                      Fastest Route Active
                    </span>
                    {focusedVehicleId !== null && (
                      <button
                        onClick={() => { setFocusedVehicleId(null); setSelectedVehicleHUD(null); }}
                        style={{
                          marginLeft: 'auto',
                          background: 'rgba(90, 106, 245, 0.2)',
                          border: '1px solid var(--indigo)',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '0.62rem',
                          padding: '1px 6px',
                          cursor: 'pointer'
                        }}
                      >
                        Reset Focus
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    Optimal road tour with {algoLabel}. Traffic clear ahead · All destinations on schedule.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span className="live-beacon live-indicator-fast" style={{ background: '#ef4444' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fca5a5', fontFamily: 'var(--font-heading)' }}>
                      Dynamic Traffic Disruption Reroute
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#fca5a5', lineHeight: 1.4 }}>
                    {timeline?.disruption?.decision_message || 'Congestion detected on primary arterial path. Instant warm-restart reoptimized fleet trajectories.'}
                  </div>
                </div>
              )}
            </div>

            {/* ── Vehicle Live Telemetry Floating HUD Card ── */}
            {selectedVehicleHUD && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 1000,
                width: '260px',
                background: 'var(--panel-2)',
                border: '1px solid var(--indigo)',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 12px 28px rgba(0,0,0,0.7), 0 0 20px rgba(90,106,245,0.3)',
                animation: 'fadeInDown 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Truck size={14} style={{ color: selectedVehicleHUD.route.color || 'var(--indigo)' }} />
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                      Vehicle {selectedVehicleHUD.route.vehicle_name}
                    </strong>
                  </div>
                  <button
                    onClick={() => { setSelectedVehicleHUD(null); setFocusedVehicleId(null); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', fontSize: '0.70rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Gauge size={11} style={{ color: 'var(--cyan)' }} /> Current Speed:
                    </span>
                    <strong style={{ color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>
                      {(38 + Math.sin(progress * 15) * 8).toFixed(1)} km/h
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Battery size={11} style={{ color: '#10b981' }} /> Battery SoC / Energy:
                    </span>
                    <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                      {Math.max(18, Math.round(100 - progress * 35))}% ({ (progress * 12.4).toFixed(1) } kWh)
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Payload:</span>
                    <strong style={{ color: 'var(--text)' }}>
                      {selectedVehicleHUD.route.load || 85} / {selectedVehicleHUD.route.capacity || 120} units
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Assigned Stops:</span>
                    <strong style={{ color: 'var(--indigo)' }}>
                      {selectedVehicleHUD.route.stops?.length || 5} stops
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>

          {/* ── Playback Controls & Timeline Scrubber ── */}
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                id="btn-play-pause"
                onClick={() => { setPlaying(p => !p); playClickTick(); }}
                className={playing ? "btn-quantum-primary" : "btn-quantum-secondary"}
                style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '82px', flexShrink: 0 }}
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                <span>{playing ? 'Pause' : 'Simulate'}</span>
              </button>

              <button
                id="btn-restart"
                onClick={handleRestart}
                className="btn-quantum-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                title="Restart simulation timeline to 08:00 AM"
              >
                <SkipBack size={13} />
              </button>

              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.80rem', fontWeight: 600, color: 'var(--text)',
                minWidth: '70px', textAlign: 'center', flexShrink: 0,
                background: 'var(--panel)', padding: '4px 8px', borderRadius: '6px',
                border: '1px solid var(--border)'
              }}>
                {formatSimClock(progress)}
              </div>

              {/* Timeline Track Scrubber */}
              <div style={{ flex: 1, position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: 'var(--panel)', borderRadius: '2px', top: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--indigo), var(--cyan))', transition: playing ? 'none' : 'width 0.05s ease' }} />
                </div>

                {/* Disruption indicator flag */}
                {timeline?.disruption && (
                  <div style={{
                    position: 'absolute', left: `${(timeline.disruption.time || 0.3) * 100}%`,
                    top: '3px', width: '2px', height: '14px', background: '#ef4444',
                    borderRadius: '1px', zIndex: 2,
                    boxShadow: '0 0 6px rgba(239,68,68,0.6)'
                  }} title={`Disruption at ${formatSimClock(timeline.disruption.time)}`} />
                )}

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
                          background: isMajor ? 'rgba(100,120,200,0.5)' : 'rgba(100,120,200,0.2)'
                        }} />
                        {isMajor && (
                          <span style={{
                            fontSize: '0.60rem', fontWeight: (hour === SIM_START_HOUR || hour === SIM_END_HOUR) ? 600 : 400,
                            color: (hour === SIM_START_HOUR || hour === SIM_END_HOUR) ? 'var(--text)' : 'var(--text-faint)',
                            whiteSpace: 'nowrap', letterSpacing: '0.01em',
                            fontFamily: 'var(--font-body)'
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
                  <button key={s} onClick={() => { setSpeed(s); playClickTick(); }}
                    className={speed === s ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
                    style={{ padding: '2px 8px', fontSize: '0.70rem', minWidth: '28px' }}>{s}x</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Config Drawer ── */}
        <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Scenario & Presets
                </h3>
                <p style={{ fontSize: '0.70rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                  {activeStops.length} stops active · {totalDemand} units demand
                </p>
              </div>
            </div>

            {/* Quick Crisis Scenario Presets Selector */}
            <div style={{ background: 'var(--panel-2)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-faint)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Operational Scenario Preset:
              </label>
              <select
                value={activePreset}
                onChange={e => handleApplyPreset(e.target.value)}
                style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', fontSize: '0.76rem', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="standard">Standard Dispatch (20 Balanced Stops)</option>
                <option value="flood">Monsoon Flash Flood (Guindy & Velachery Inundated)</option>
                <option value="kathipara">Peak Hour Kathipara Flyover Gridlock</option>
                <option value="medical">Urgent Hospital Medical Supplies Rush</option>
                <option value="ev_green">Zero-Emission EV Fleet (70kg capacity / 5 vans)</option>
              </select>
            </div>

            {/* Segmented Tab Switcher */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px',
              background: 'var(--panel-2)', padding: '3px', borderRadius: '8px',
              border: '1px solid var(--border)', flexShrink: 0
            }}>
              <button
                onClick={() => { setSidebarTab('config'); playClickTick(); }}
                style={{
                  padding: '7px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  background: sidebarTab === 'config' ? 'var(--panel)' : 'transparent',
                  color: sidebarTab === 'config' ? 'var(--text)' : 'var(--text-dim)',
                  boxShadow: sidebarTab === 'config' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  border: sidebarTab === 'config' ? '1px solid var(--border)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <Truck size={13} style={{ color: sidebarTab === 'config' ? 'var(--indigo)' : 'inherit' }} /> Fleet & Controls
              </button>
              <button
                onClick={() => { setSidebarTab('demands'); playClickTick(); }}
                style={{
                  padding: '7px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  background: sidebarTab === 'demands' ? 'var(--panel)' : 'transparent',
                  color: sidebarTab === 'demands' ? 'var(--text)' : 'var(--text-dim)',
                  boxShadow: sidebarTab === 'demands' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  border: sidebarTab === 'demands' ? '1px solid var(--border)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📋</span> Demands & Stops ({activeStops.length})
              </button>
            </div>

            {sidebarTab === 'config' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
                {/* Algorithm dropdown */}
                <div style={{ background: 'var(--panel-2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.70rem', color: 'var(--text-faint)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Algorithm</label>
                  <select
                    value={selectedAlgo}
                    onChange={e => handleAlgoChange(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', fontSize: '0.80rem' }}
                  >
                    {algorithms.map(a => (
                      <option key={a.key} value={a.key}>
                        {a.label}{a.is_primary ? ' [Primary Engine]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fleet settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--panel-2)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div>
                    <label style={{ fontSize: '0.70rem', color: 'var(--text-faint)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Trucks</label>
                    <select value={numTrucks} onChange={e => handleTrucksChange(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', fontSize: '0.80rem' }}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Truck{n>1?'s':''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.70rem', color: 'var(--text-faint)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Capacity / Truck</label>
                    <input type="number" value={truckCap}
                      onChange={e => handleCapChange(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', fontSize: '0.80rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.70rem', color: 'var(--text-faint)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Depot Location</label>
                    <select value={depotId} onChange={e => handleDepotChange(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', fontSize: '0.80rem' }}>
                      {locations.map(l => <option key={l.id} value={l.id}>#{l.id} — {l.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fleet Manifest Header + CSV Export Button */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0, marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
                      <Truck size={13} style={{ color: 'var(--indigo)' }} /> Fleet Manifest ({activeRoutes.length} Vehicles)
                    </span>
                    <button
                      onClick={exportManifestCSV}
                      className="btn-quantum-secondary"
                      style={{ padding: '2px 8px', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                      title="Download formatted CSV route schedule"
                    >
                      <Download size={11} /> CSV
                    </button>
                  </div>

                  {/* Fleet Manifest Rows */}
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
                      const isSoloFocused = focusedVehicleId === rIdx;

                      return (
                        <div
                          key={`manifest-${rIdx}`}
                          onClick={() => {
                            playClickTick();
                            setFocusedVehicleId(isSoloFocused ? null : rIdx);
                            setSelectedVehicleHUD({ route, idx: rIdx, p, posInfo: null });
                          }}
                          style={{
                            background: isSoloFocused ? 'rgba(90, 106, 245, 0.15)' : 'var(--panel-2)',
                            borderRadius: '10px',
                            border: isSoloFocused ? '1px solid var(--indigo)' : isAffected ? '1px solid rgba(239,68,68,0.4)' : `1px solid var(--border)`,
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: isSoloFocused ? '0 0 14px rgba(90,106,245,0.3)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, boxShadow: `0 0 8px ${col}` }} />
                              <strong style={{ fontSize: '0.78rem', color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Vehicle {name}</strong>
                              {isSoloFocused && (
                                <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', background: 'var(--indigo)', color: '#fff', fontWeight: 700 }}>
                                  SOLO FOCUS
                                </span>
                              )}
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
                              fontSize: '0.66rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                              background: isDone ? 'rgba(51,225,232,0.12)' : 'rgba(108,123,255,0.15)',
                              color: isDone ? 'var(--cyan)' : 'var(--indigo)',
                              border: isDone ? '1px solid rgba(51,225,232,0.3)' : '1px solid rgba(108,123,255,0.3)',
                              fontFamily: 'var(--font-heading)'
                            }}>
                              {isDone ? 'Parked at Depot (Done)' : `Stop ${Math.min(currStopIdx + 1, stops.length)}/${stops.length}`}
                            </span>
                          </div>

                          {/* Capacity bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'var(--panel)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, (totalRouteDemand / cap) * 100)}%`, height: '100%', background: col }} />
                            </div>
                            <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)' }}>
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
                                        ? 'rgba(16,27,66,0.5)'
                                        : 'var(--panel)',
                                  border: isDisruptedStop
                                    ? '1px solid #ef4444'
                                    : isCurrent
                                      ? `1px solid ${col}`
                                      : '1px solid var(--border)',
                                  color: isDisruptedStop
                                    ? '#fca5a5'
                                    : isVisited
                                      ? 'var(--text-faint)'
                                      : 'var(--text)',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--panel-2)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    Demand: <strong style={{ color: 'var(--text)' }}>{totalDemand}</strong> / Capacity: <strong style={{ color: 'var(--text)' }}>{numTrucks * truckCap}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={handleResetDemands}
                      className="btn-quantum-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.68rem', cursor: 'pointer' }}>
                      Reset
                    </button>
                    <button onClick={() => handleToggleAll(true)}
                      className="btn-quantum-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.68rem', cursor: 'pointer' }}>
                      All
                    </button>
                    <button onClick={() => handleToggleAll(false)}
                      className="btn-quantum-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.68rem', cursor: 'pointer' }}>
                      None
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel-2)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: '0.66rem' }}>
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
                              borderBottom: '1px solid var(--border)',
                              background: isDisrupted ? 'rgba(239,68,68,0.1)' : isDepot ? 'rgba(108,123,255,0.06)' : 'transparent'
                            }}>
                            <td style={{ padding: '6px 8px' }}>
                              <input type="checkbox"
                                checked={loc.enabled || isDepot}
                                disabled={isDepot}
                                onChange={() => handleLocationToggle(loc.id)}
                                style={{ accentColor: 'var(--indigo)', cursor: isDepot ? 'default' : 'pointer' }} />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isDepot ? 'var(--indigo)' : 'var(--text)' }}>
                                  {isDepot ? '★' : `#${loc.id}`}
                                </span>
                                <span style={{ color: isDisrupted ? '#fca5a5' : 'var(--text)', fontSize: '0.73rem' }}>
                                  {loc.name}
                                  {isDisrupted && ' ⚠'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                              {isDepot ? <span style={{ color: 'var(--text-faint)' }}>—</span> : (
                                <input type="number" min="0" max="1000" value={loc.demand}
                                  disabled={!loc.enabled}
                                  onChange={e => handleDemandChange(loc.id, e.target.value)}
                                  style={{ width: '54px', padding: '3px 5px', borderRadius: '4px', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.75rem', textAlign: 'right', border: '1px solid var(--border)' }} />
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

      {/* Disruption Sandbox Modal */}
      <DisruptionSandboxModal
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        stops={locations}
        onApplyDisruption={handleSandboxApply}
        activeDisruption={customDisruption}
        onClearDisruption={handleSandboxClear}
      />

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
