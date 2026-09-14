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

/* ─────────── Quantum Console Route Map ─────────── */
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

  const routeColors = ['#5A6AF5', '#2BC9D6', '#7A5AF0', '#5A6AF5', '#2BC9D6'];

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
      {routes && routes.map((route, ri) => {
        const pts = route.map(id => stopMap[id]).filter(Boolean).map(p => `${p.sx},${p.sy}`).join(' ');
        const col = routeColors[ri % routeColors.length];
        return pts ? (
          <polyline
            key={ri}
            points={pts}
            fill="none"
            stroke={col}
            strokeOpacity={0.85}
            strokeWidth={1.8}
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
            fill={isDepot ? '#2BC9D6' : '#77809E'}
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
      {/* Top Controls Bar */}
      <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Stops', val: numNodes, set: setNumNodes, min: 10, max: 40, step: 5 },
          { label: 'Swarm', val: swarmSize, set: setSwarmSize, min: 10, max: 40, step: 5 },
          { label: 'Iterations', val: maxIters, set: setMaxIters, min: 20, max: 100, step: 10 }
        ].map(cfg => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 500 }}>{cfg.label}:</span>
            <input
              type="number"
              value={cfg.val}
              min={cfg.min}
              max={cfg.max}
              step={cfg.step}
              onChange={e => cfg.set(Number(e.target.value))}
              style={{
                width: '60px', padding: '4px 6px', borderRadius: '6px',
                fontSize: '0.78rem', outline: 'none'
              }}
            />
          </div>
        ))}

        <button
          onClick={runSolve}
          disabled={solving}
          className="btn-quantum-primary"
          style={{ marginLeft: 'auto', padding: '8px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {solving ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
          {solving ? 'Solving...' : 'Run Solve'}
        </button>

        {error && (
          <div style={{ fontSize: '0.75rem', color: '#fca5a5', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!solved && !solving && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexDirection: 'column', gap: '8px' }}>
          <Activity size={36} strokeWidth={1.5} color="var(--indigo)" />
          <div style={{ fontSize: '0.95rem', color: 'var(--text)', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Architecture Stepper</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            Click Run Solve to step through all 5 layers sequentially.
          </div>
        </div>
      )}

      {/* Running State */}
      {solving && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: 'var(--text-dim)' }}>
          <Loader2 size={36} className="spin" color="var(--indigo)" />
          <div style={{ fontSize: '0.9rem', color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Executing solve...</div>
        </div>
      )}

      {/* Interactive Step-by-Step Level Walker */}
      {solved && log.length > 0 && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: '14px', minHeight: 0 }}>
          
          {/* Main Stage View */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
            
            {/* Iteration Slider Bar */}
            <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                    Iteration:
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                    {iterIdx + 1}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    / {log.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Best Cost:</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>
                    {frame?.global_best_cost}
                  </span>
                </div>
              </div>

              {/* Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.70rem', color: 'var(--text-faint)', fontFamily: 'var(--font-heading)' }}>1</span>
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
                    accentColor: 'var(--cyan)',
                    cursor: 'pointer',
                    height: '6px'
                  }}
                />
                <span style={{ fontSize: '0.70rem', color: 'var(--text-faint)', fontFamily: 'var(--font-heading)' }}>{log.length}</span>
              </div>
            </div>

            {/* Stepper Dots/Chips */}
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
                        borderRadius: '8px',
                        background: isCurrent ? 'rgba(108,123,255,0.18)' : isPassed ? 'rgba(16,27,66,0.5)' : 'var(--panel-2)',
                        border: `1px solid ${isCurrent ? 'var(--indigo)' : isPassed ? 'rgba(108,123,255,0.3)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <StepIcon size={14} color={isCurrent ? 'var(--indigo)' : isPassed ? 'var(--text)' : 'var(--text-faint)'} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: isCurrent ? 'var(--indigo)' : 'var(--text-faint)', fontFamily: 'var(--font-heading)' }}>
                          {s.stepNum}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isCurrent ? 'var(--text)' : isPassed ? 'var(--text-dim)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                      </div>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div style={{ width: '10px', height: '1px', background: i < stepIdx ? 'var(--indigo)' : 'var(--border)', flexShrink: 0 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Current Step Detailed Card */}
            <div className="glass-card" style={{
              flex: 1,
              padding: '22px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              minHeight: 0
            }}>
              
              {/* Step Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '10px',
                  background: 'rgba(108,123,255,0.15)',
                  border: '1px solid rgba(108,123,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {React.createElement(currentStep.icon, { size: 22, color: 'var(--indigo)' })}
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--indigo)', textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>
                    {currentStep.stepNum} · {currentStep.visualBadge}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, fontFamily: 'var(--font-heading)' }}>
                    {currentStep.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {currentStep.subTitle}
                  </div>
                </div>

                {/* Status Indicator */}
                <div style={{ marginLeft: 'auto' }}>
                  {currentStep.alwaysRuns ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: 700,
                      background: 'rgba(108,123,255,0.12)', color: 'var(--indigo)', border: '1px solid rgba(108,123,255,0.3)',
                      fontFamily: 'var(--font-heading)'
                    }}>
                      ALWAYS RUNS
                    </span>
                  ) : didFire ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: 700,
                      background: 'rgba(51,225,232,0.12)', color: 'var(--cyan)', border: '1px solid rgba(51,225,232,0.35)',
                      fontFamily: 'var(--font-heading)'
                    }}>
                      ACTIVE THIS ROUND
                    </span>
                  ) : (
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: 700,
                      background: 'var(--panel-2)', color: 'var(--text-faint)', border: '1px solid var(--border)',
                      fontFamily: 'var(--font-heading)'
                    }}>
                      DORMANT
                    </span>
                  )}
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)' }} />

              {/* Concise Explanation */}
              <div style={{ background: 'var(--panel-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', fontFamily: 'var(--font-heading)' }}>
                  Operation:
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.5 }}>
                  {currentStep.simpleWhat}
                </div>
              </div>

              {/* Layer Compute Time */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--panel-2)',
                border: '1px solid var(--border)'
              }}>
                <Clock size={16} color="var(--indigo)" />
                <span style={{ fontSize: '0.80rem', color: 'var(--text-dim)' }}>Layer Compute Time:</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--cyan)' }}>
                  {durationMs.toFixed(3)} ms
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: 'auto' }}>
                  Measured CPU execution time
                </span>
              </div>

              {/* Conditional explanation */}
              {!currentStep.alwaysRuns && !didFire && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--panel-2)', border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {currentStep.id === 'l3_chaos'
                    ? 'Condition: Stagnation threshold (<10 rounds unchanged) not met.'
                    : 'Condition: Executes strictly every 15 iterations.'}
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* Step Navigation Controls (Prev Step / Next Step) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button
                  onClick={prevStep}
                  disabled={isFirstStep}
                  className="btn-quantum-secondary"
                  style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                >
                  <ChevronLeft size={15} /> Previous Step
                </button>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-heading)' }}>
                  Step {stepIdx + 1} of {PIPELINE_STEPS.length}
                </div>

                {!isLastStep ? (
                  <button
                    onClick={nextStep}
                    className="btn-quantum-primary"
                    style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                  >
                    Next Step ({PIPELINE_STEPS[stepIdx + 1].name}) <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={nextIter}
                    disabled={isLastIter}
                    className="btn-quantum-primary"
                    style={{
                      padding: '8px 22px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem',
                      opacity: isLastIter ? 0.5 : 1
                    }}
                  >
                    Finish Round & Go to Iteration {iterIdx + 2} <ChevronsRight size={15} />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Right Visuals Panel (Map + Graph) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
            
            {/* Route Map */}
            <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.05em', fontFamily: 'var(--font-heading)' }}>
                Route Map · Iteration {iterIdx + 1}
              </div>
              <RouteMap stops={stops} routes={frame?.best_route || []} />
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                {frame?.best_route?.length || 0} vehicles · {stops.length - 1} stops
              </div>
            </div>

            {/* Convergence Graph */}
            <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.05em', fontFamily: 'var(--font-heading)' }}>
                Cost Convergence
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={convergenceData} margin={{ top: 6, right: 6, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(120,140,220,0.14)" />
                    <XAxis dataKey="iter" stroke="var(--text-faint)" tick={{ fill: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-heading)' }} />
                    <YAxis stroke="var(--text-faint)" tick={{ fill: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-heading)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)' }}
                      formatter={v => [`${v}`, 'Distance']}
                    />
                    <Line type="monotone" dataKey="cost" stroke="var(--indigo)" strokeWidth={1.8} dot={false} />
                    {frame && (
                      <Line
                        data={[{ iter: iterIdx + 1, cost: frame.global_best_cost }]}
                        type="monotone"
                        dataKey="cost"
                        stroke="var(--cyan)"
                        strokeWidth={0}
                        dot={{ r: 5, fill: 'var(--cyan)', stroke: '#ffffff', strokeWidth: 1.5 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.70rem', color: 'var(--text-dim)', textAlign: 'right' }}>
                Best: <span style={{ color: 'var(--cyan)', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{frame?.global_best_cost}</span>
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => { setIterIdx(0); setStepIdx(0); }}
              className="btn-quantum-secondary"
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

