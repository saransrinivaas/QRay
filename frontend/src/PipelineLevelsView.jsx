import React, { useState, useCallback } from 'react';
import {
  Database, Cpu, Zap, TrendingDown, ShieldCheck,
  ChevronLeft, ChevronRight, Activity, Loader2,
  AlertTriangle, Clock, ChevronsRight, RotateCcw
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

/* ─────────── 5 Sequential Steps In Every Iteration (Monochrome & Concise) ─────────── */
const PIPELINE_STEPS = [
  {
    id: 'l1_decode',
    stepNum: 'Step 1',
    name: 'Decode Routes',
    subTitle: 'Convert particle keys into vehicle stop sequences',
    icon: Database,
    simpleWhat: 'Converts particle continuous keys into real stop visits, splitting by vehicle capacity.',
    visualBadge: 'Decode',
    alwaysRuns: true
  },
  {
    id: 'l2_qpso_update',
    stepNum: 'Step 2',
    name: 'Quantum Swarm Move',
    subTitle: 'Update particle positions across potential well',
    icon: Cpu,
    simpleWhat: 'Calculates mean-best position (mbest) and moves particles quantum-probabilistically.',
    visualBadge: 'Swarm Math',
    alwaysRuns: true
  },
  {
    id: 'l3_chaos',
    stepNum: 'Step 3',
    name: 'Chaos Perturbation',
    subTitle: 'Stagnation escape mechanism',
    icon: Zap,
    simpleWhat: 'Applies logistic map perturbation to worst-50% particles if stagnant for ≥10 iterations.',
    visualBadge: 'Conditional',
    alwaysRuns: false
  },
  {
    id: 'l3_2opt',
    stepNum: 'Step 4',
    name: 'Guarded 2-Opt',
    subTitle: 'Path uncrossing refinement',
    icon: TrendingDown,
    simpleWhat: 'Executes one-pass edge swaps on the best route every 15 iterations to remove crossed paths.',
    visualBadge: 'Cadence: 15 Iters',
    alwaysRuns: false
  },
  {
    id: 'l5_feasibility',
    stepNum: 'Step 5',
    name: 'Feasibility Gate',
    subTitle: 'Capacity and routing constraint evaluation',
    icon: ShieldCheck,
    simpleWhat: 'Checks vehicle capacity limits, single-visit rules, and applies quadratic penalties to invalid solutions.',
    visualBadge: 'Validation',
    alwaysRuns: true
  }
];

const STAGE_TIMING_MAP = {
  l1_decode: 'decode_feasibility',
  l2_qpso_update: 'qpso_math',
  l3_chaos: 'chaos',
  l3_2opt: 'twoopt',
  l5_feasibility: 'decode_feasibility'
};

/* ─────────── Monochrome Route Map ─────────── */
function RouteMap({ stops, routes }) {
  if (!stops || stops.length === 0) return null;
  const svgW = 210, svgH = 160, pad = 14;
  const xs = stops.map(s => s.x), ys = stops.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rx = maxX - minX || 1, ry = maxY - minY || 1;

  const toSVG = (x, y) => ({
    sx: pad + ((x - minX) / rx) * (svgW - 2 * pad),
    sy: pad + ((y - minY) / ry) * (svgH - 2 * pad)
  });

  const stopMap = {};
  stops.forEach(s => { stopMap[s.id] = toSVG(s.x, s.y); });

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
      {routes && routes.map((route, ri) => {
        const pts = route.map(id => stopMap[id]).filter(Boolean).map(p => `${p.sx},${p.sy}`).join(' ');
        const opacities = [1.0, 0.75, 0.55, 0.4, 0.3];
        const strokeWidths = [2.0, 1.6, 1.4, 1.2, 1.0];
        return pts ? (
          <polyline
            key={ri}
            points={pts}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={opacities[ri % opacities.length]}
            strokeWidth={strokeWidths[ri % strokeWidths.length]}
            strokeLinejoin="round"
          />
        ) : null;
      })}
      {stops.map(s => {
        const p = stopMap[s.id];
        if (!p) return null;
        const isDepot = s.id === 0;
        return (
          <circle
            key={s.id}
            cx={p.sx}
            cy={p.sy}
            r={isDepot ? 5 : 2.5}
            fill={isDepot ? '#ffffff' : '#71717a'}
            stroke={isDepot ? '#ffffff' : 'none'}
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

export default function PipelineLevelsView() {
  const [log, setLog]         = useState([]);
  const [stops, setStops]     = useState([]);
  const [solving, setSolving] = useState(false);
  const [solved, setSolved]   = useState(false);
  const [error, setError]     = useState('');

  // Iteration index & Step index inside that iteration
  const [iterIdx, setIterIdx]   = useState(0);
  const [stepIdx, setStepIdx]   = useState(0);

  // Settings
  const [numNodes, setNumNodes]   = useState(20);
  const [swarmSize, setSwarmSize] = useState(20);
  const [maxIters, setMaxIters]   = useState(60);

  const frame        = log[iterIdx] || null;
  const activeLayers = frame?.active_layers || {};
  const currentStep  = PIPELINE_STEPS[stepIdx];

  const didFire = currentStep.alwaysRuns || !!activeLayers[currentStep.id];
  const timingField = STAGE_TIMING_MAP[currentStep.id];
  const durationMs = frame?.timing_ms?.[timingField] ?? 0;

  const runSolve = useCallback(async () => {
    setSolving(true); setError(''); setSolved(false);
    setLog([]); setIterIdx(0); setStepIdx(0);
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_nodes: numNodes,
          num_vehicles: Math.max(2, Math.ceil(numNodes / 5)),
          vehicle_capacity: 120.0,
          swarm_size: swarmSize,
          alpha: 0.7,
          opt2_freq: 15,
          max_iterations: maxIters,
          use_chaos: true,
          use_2opt: true,
          seed: 42
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLog(data.iteration_log || []);
      setStops(data.stop_coords || []);
      setIterIdx(0); setStepIdx(0);
      setSolved(true);
    } catch {
      setError('Backend unreachable on port 8000.');
    } finally {
      setSolving(false);
    }
  }, [numNodes, swarmSize, maxIters]);

  const prevStep = () => setStepIdx(i => Math.max(0, i - 1));
  const nextStep = () => setStepIdx(i => Math.min(PIPELINE_STEPS.length - 1, i + 1));

  const isFirstStep = stepIdx === 0;
  const isLastStep  = stepIdx === PIPELINE_STEPS.length - 1;
  const isLastIter  = iterIdx === log.length - 1;

  const nextIter = () => {
    setIterIdx(i => Math.min(log.length - 1, i + 1));
    setStepIdx(0);
  };

  const convergenceData = log.map((f, i) => ({ iter: i + 1, cost: f.global_best_cost }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0 }}>
      {/* Top Controls Bar (Monochrome) */}
      <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.15)' }}>
        {[
          { label: 'Stops', val: numNodes, set: setNumNodes, min: 10, max: 40, step: 5 },
          { label: 'Swarm', val: swarmSize, set: setSwarmSize, min: 10, max: 40, step: 5 },
          { label: 'Iterations', val: maxIters, set: setMaxIters, min: 20, max: 100, step: 10 }
        ].map(cfg => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>{cfg.label}:</span>
            <input
              type="number"
              value={cfg.val}
              min={cfg.min}
              max={cfg.max}
              step={cfg.step}
              onChange={e => cfg.set(Number(e.target.value))}
              style={{
                width: '60px', padding: '4px 6px', borderRadius: '4px',
                background: '#18181b', color: '#fff', fontSize: '0.78rem',
                border: '1px solid rgba(255,255,255,0.15)', outline: 'none'
              }}
            />
          </div>
        ))}

        <button
          onClick={runSolve}
          disabled={solving}
          className="btn-material-white"
          style={{ marginLeft: 'auto', padding: '8px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {solving ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
          {solving ? 'Solving...' : 'Run Solve'}
        </button>

        {error && (
          <div style={{ fontSize: '0.75rem', color: '#ffffff', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!solved && !solving && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', flexDirection: 'column', gap: '8px' }}>
          <Activity size={36} strokeWidth={1.5} color="#ffffff" />
          <div style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 600 }}>Architecture Stepper</div>
          <div style={{ fontSize: '0.82rem', color: '#a1a1aa' }}>
            Click Run Solve to step through all 5 layers sequentially.
          </div>
        </div>
      )}

      {/* Running State */}
      {solving && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: '#a1a1aa' }}>
          <Loader2 size={36} className="spin" color="#ffffff" />
          <div style={{ fontSize: '0.9rem', color: '#ffffff' }}>Executing solve...</div>
        </div>
      )}

      {/* Interactive Step-by-Step Level Walker (Monochrome) */}
      {solved && log.length > 0 && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: '14px', minHeight: 0 }}>
          
          {/* Main Stage View */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
            
            {/* Iteration Slider Bar (Monochrome) */}
            <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Iteration:
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
                    {iterIdx + 1}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
                    / {log.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Best Cost:</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                    {frame?.global_best_cost}
                  </span>
                </div>
              </div>

              {/* Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.7rem', color: '#71717a', fontFamily: 'monospace' }}>1</span>
                <input
                  type="range"
                  min={0}
                  max={log.length - 1}
                  value={iterIdx}
                  onChange={e => {
                    setIterIdx(Number(e.target.value));
                    setStepIdx(0);
                  }}
                  style={{
                    flex: 1,
                    accentColor: '#ffffff',
                    cursor: 'pointer',
                    height: '6px'
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: '#71717a', fontFamily: 'monospace' }}>{log.length}</span>
              </div>
            </div>

            {/* Stepper Dots/Chips (Monochrome) */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
              {PIPELINE_STEPS.map((s, i) => {
                const isCurrent = i === stepIdx;
                const isPassed  = i < stepIdx;
                const StepIcon  = s.icon;

                return (
                  <React.Fragment key={s.id}>
                    <div
                      onClick={() => setStepIdx(i)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: isCurrent ? 'rgba(255,255,255,0.12)' : isPassed ? 'rgba(255,255,255,0.04)' : 'transparent',
                        border: `1px solid ${isCurrent ? '#ffffff' : isPassed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <StepIcon size={14} color={isCurrent ? '#ffffff' : isPassed ? '#d4d4d8' : '#52525b'} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: isCurrent ? '#ffffff' : '#71717a' }}>
                          {s.stepNum}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isCurrent ? '#ffffff' : isPassed ? '#a1a1aa' : '#52525b', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                      </div>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div style={{ width: '10px', height: '1px', background: i < stepIdx ? '#ffffff' : 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Current Step Detailed Card (Monochrome & Concise) */}
            <div className="glass-card" style={{
              flex: 1,
              padding: '22px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid rgba(255,255,255,0.2)',
              minHeight: 0
            }}>
              
              {/* Step Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {React.createElement(currentStep.icon, { size: 22, color: '#ffffff' })}
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
                    {currentStep.stepNum} · {currentStep.visualBadge}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                    {currentStep.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#71717a' }}>
                    {currentStep.subTitle}
                  </div>
                </div>

                {/* Status Indicator */}
                <div style={{ marginLeft: 'auto' }}>
                  {currentStep.alwaysRuns ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                      background: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      ALWAYS RUNS
                    </span>
                  ) : didFire ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                      background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid #ffffff'
                    }}>
                      ACTIVE THIS ROUND
                    </span>
                  ) : (
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                      background: 'rgba(255,255,255,0.03)', color: '#71717a', border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      DORMANT
                    </span>
                  )}
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }} />

              {/* Concise Explanation */}
              <div style={{ background: '#09090b', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  Operation:
                </div>
                <div style={{ fontSize: '0.9rem', color: '#d4d4d8', lineHeight: 1.5 }}>
                  {currentStep.simpleWhat}
                </div>
              </div>

              {/* Layer Compute Time */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Clock size={16} color="#ffffff" />
                <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Layer Compute Time:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                  {durationMs.toFixed(3)} ms
                </span>
                <span style={{ fontSize: '0.72rem', color: '#71717a', marginLeft: 'auto' }}>
                  Measured CPU execution time
                </span>
              </div>

              {/* Conditional explanation */}
              {!currentStep.alwaysRuns && !didFire && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', color: '#a1a1aa' }}>
                  {currentStep.id === 'l3_chaos'
                    ? 'Condition: Stagnation threshold (<10 rounds unchanged) not met.'
                    : 'Condition: Executes strictly every 15 iterations.'}
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* Step Navigation Controls (Prev Step / Next Step) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                <button
                  onClick={prevStep}
                  disabled={isFirstStep}
                  className="btn-material-outline"
                  style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                >
                  <ChevronLeft size={15} /> Previous Step
                </button>

                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
                  Step {stepIdx + 1} of {PIPELINE_STEPS.length}
                </div>

                {!isLastStep ? (
                  <button
                    onClick={nextStep}
                    className="btn-material-white"
                    style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                  >
                    Next Step ({PIPELINE_STEPS[stepIdx + 1].name}) <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={nextIter}
                    disabled={isLastIter}
                    className="btn-material-white"
                    style={{
                      padding: '8px 22px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem',
                      background: isLastIter ? '#27272a' : '#ffffff',
                      color: isLastIter ? '#71717a' : '#000000',
                      border: 'none'
                    }}
                  >
                    Finish Round & Go to Iteration {iterIdx + 2} <ChevronsRight size={15} />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Right Visuals Panel (Map + Graph) - Monochrome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
            
            {/* Route Map */}
            <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em' }}>
                Route Map · Iteration {iterIdx + 1}
              </div>
              <RouteMap stops={stops} routes={frame?.best_route || []} />
              <div style={{ fontSize: '0.68rem', color: '#71717a', textAlign: 'center' }}>
                {frame?.best_route?.length || 0} vehicles · {stops.length - 1} stops
              </div>
            </div>

            {/* Convergence Graph */}
            <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em' }}>
                Cost Convergence
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={convergenceData} margin={{ top: 6, right: 6, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="iter" stroke="#52525b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#52525b" tick={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '11px' }}
                      formatter={v => [`${v}`, 'Distance']}
                    />
                    <Line type="monotone" dataKey="cost" stroke="#ffffff" strokeWidth={1.5} dot={false} />
                    {frame && (
                      <Line
                        data={[{ iter: iterIdx + 1, cost: frame.global_best_cost }]}
                        type="monotone"
                        dataKey="cost"
                        stroke="#ffffff"
                        strokeWidth={0}
                        dot={{ r: 5, fill: '#ffffff', strokeWidth: 0 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#a1a1aa', textAlign: 'right' }}>
                Best: <span style={{ color: '#ffffff', fontWeight: 800 }}>{frame?.global_best_cost}</span>
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => { setIterIdx(0); setStepIdx(0); }}
              className="btn-material-outline"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem' }}
            >
              <RotateCcw size={12} /> Reset to Start
            </button>
          </div>

        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
