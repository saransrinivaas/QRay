import React, { useState, useEffect, useRef } from 'react';
import { 
  Atom, Zap, Play, Pause, RotateCcw, Sliders, 
  Cpu, TrendingDown, ShieldCheck, Sparkles, Activity
} from 'lucide-react';

export default function QuantumSwarmVisualizer() {
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(true);
  
  // Quantum Hyperparameters
  const [alpha, setAlpha] = useState(0.72); // Contraction-expansion coefficient
  const [swarmSize, setSwarmSize] = useState(40);
  const [chaosEnabled, setChaosEnabled] = useState(true);
  const [twoOptEnabled, setTwoOptEnabled] = useState(true);
  const [barrierHeight, setBarrierHeight] = useState(65);

  // Live telemetry metrics
  const [globalBestEnergy, setGlobalBestEnergy] = useState(42.5);
  const [tunnelEvents, setTunnelEvents] = useState(0);
  const [chaosPulses, setChaosPulses] = useState(0);
  const [iteration, setIteration] = useState(0);

  // Particles state ref for 60fps loop
  const stateRef = useRef({
    particles: [],
    mbest: { x: 300, y: 200 },
    gbest: { x: 300, y: 200, energy: 999 },
    stagnationCount: 0,
    chaosPulseActive: false,
    pulseTimer: 0,
    iter: 0,
    tunnelCount: 0,
    chaosCount: 0,
  });

  // Initialize particles
  const initParticles = (n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 600;
      const y = Math.random() * 320;
      pts.push({
        id: i,
        x,
        y,
        pbestX: x,
        pbestY: y,
        energy: 100,
        pbestEnergy: 100,
        tunneling: false,
        phase: Math.random() * Math.PI * 2,
        color: `hsl(${180 + Math.random() * 60}, 90%, 65%)`
      });
    }
    stateRef.current.particles = pts;
    stateRef.current.iter = 0;
    stateRef.current.tunnelCount = 0;
    stateRef.current.chaosCount = 0;
    setIteration(0);
    setTunnelEvents(0);
    setChaosPulses(0);
  };

  useEffect(() => {
    initParticles(swarmSize);
  }, [swarmSize]);

  // Energy Landscape function with multi-well potential barriers
  const calculatePotentialEnergy = (x, y, barrierH) => {
    // Global minimum around (420, 220)
    const gx = 420, gy = 220;
    const distG = Math.hypot(x - gx, y - gy);

    // Local trap minimum around (180, 120)
    const lx = 180, ly = 120;
    const distL = Math.hypot(x - lx, y - ly);

    // Barrier peak in the middle around (300, 170)
    const bx = 300, by = 170;
    const distB = Math.hypot(x - bx, y - by);
    const barrier = Math.exp(-Math.pow(distB / 70, 2)) * barrierH;

    const baseCost = 0.0015 * Math.pow(distG, 2) + Math.min(30, 0.002 * Math.pow(distL, 2)) + barrier;
    return baseCost;
  };

  // Main 60fps Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      const state = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#050914';
      ctx.fillRect(0, 0, w, h);

      // 2. Draw Quantum Potential Energy Field (Contour heatmap)
      const gridSize = 20;
      for (let x = 0; x < w; x += gridSize) {
        for (let y = 0; y < h; y += gridSize) {
          const energy = calculatePotentialEnergy(x, y, barrierHeight);
          const norm = Math.min(1, Math.max(0, (energy - 20) / 100));
          ctx.fillStyle = `rgba(${Math.floor(norm * 180 + 20)}, ${Math.floor((1 - norm) * 100)}, ${Math.floor((1 - norm) * 240)}, 0.07)`;
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }

      // Draw Barrier Zone
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(300, 170, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fill();

      // Barrier label
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Potential Energy Barrier (Local Minima Trap)', 210, 165);

      // Global Minimum Target Indicator
      ctx.strokeStyle = '#33E1E8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(420, 220, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#33E1E8';
      ctx.font = '11px Space Grotesk, sans-serif';
      ctx.fillText('★ Global Optimum', 380, 260);

      // 3. Update Swarm Mathematics if running
      if (running && state.particles.length > 0) {
        state.iter += 1;

        // Calculate mbest (mean of personal bests)
        let sumX = 0, sumY = 0;
        state.particles.forEach(p => {
          sumX += p.pbestX;
          sumY += p.pbestY;
        });
        state.mbest.x = sumX / state.particles.length;
        state.mbest.y = sumY / state.particles.length;

        // Check for stagnation
        let improved = false;

        state.particles.forEach((p) => {
          // Quantum delta potential well position update
          const phi1 = Math.random();
          const phi2 = Math.random();
          const pLocalX = (phi1 * p.pbestX + phi2 * state.gbest.x) / (phi1 + phi2 || 1);
          const pLocalY = (phi1 * p.pbestY + phi2 * state.gbest.y) / (phi1 + phi2 || 1);

          const u = Math.random();
          const L_x = alpha * Math.abs(state.mbest.x - p.x);
          const L_y = alpha * Math.abs(state.mbest.y - p.y);
          const lnTerm = Math.log(1 / (u || 0.0001));

          const signX = Math.random() > 0.5 ? 1 : -1;
          const signY = Math.random() > 0.5 ? 1 : -1;

          let nextX = pLocalX + signX * L_x * lnTerm;
          let nextY = pLocalY + signY * L_y * lnTerm;

          // Boundary bounce
          nextX = Math.max(10, Math.min(w - 10, nextX));
          nextY = Math.max(10, Math.min(h - 10, nextY));

          // Check if tunneling through the barrier
          const distToBarrier = Math.hypot(nextX - 300, nextY - 170);
          if (distToBarrier < 70 && p.x < 260 && nextX > 320) {
            p.tunneling = true;
            state.tunnelCount += 1;
          } else {
            p.tunneling = false;
          }

          p.x = nextX;
          p.y = nextY;
          p.energy = calculatePotentialEnergy(nextX, nextY, barrierHeight);

          if (p.energy < p.pbestEnergy) {
            p.pbestEnergy = p.energy;
            p.pbestX = nextX;
            p.pbestY = nextY;
          }

          if (p.energy < state.gbest.energy) {
            state.gbest.energy = p.energy;
            state.gbest.x = nextX;
            state.gbest.y = nextY;
            improved = true;
          }
        });

        if (improved) {
          state.stagnationCount = 0;
        } else {
          state.stagnationCount += 1;
        }

        // Chaos Perturbation Escape Mechanism (Logistic Map)
        if (chaosEnabled && state.stagnationCount > 15) {
          state.chaosPulseActive = true;
          state.chaosCount += 1;
          state.stagnationCount = 0;

          // Apply logistic map perturbation: x_{t+1} = 4 * x_t * (1 - x_t)
          let mu = 0.62;
          state.particles.forEach((p, idx) => {
            if (idx % 2 === 0) {
              mu = 3.99 * mu * (1 - mu);
              p.x = (p.x + (mu - 0.5) * 120 + w) % w;
              p.y = (p.y + (mu - 0.5) * 80 + h) % h;
            }
          });
        }

        if (state.chaosPulseActive) {
          state.pulseTimer += 1;
          if (state.pulseTimer > 10) {
            state.chaosPulseActive = false;
            state.pulseTimer = 0;
          }
        }

        // Sync React state periodically
        if (state.iter % 4 === 0) {
          setIteration(state.iter);
          setGlobalBestEnergy(+state.gbest.energy.toFixed(2));
          setTunnelEvents(state.tunnelCount);
          setChaosPulses(state.chaosCount);
        }
      }

      // 4. Render Particle Probability Clouds and Waves
      state.particles.forEach((p) => {
        // Quantum probability halo
        ctx.fillStyle = p.tunneling ? 'rgba(239, 68, 68, 0.4)' : 'rgba(108, 123, 255, 0.18)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.tunneling ? 14 : 9, 0, Math.PI * 2);
        ctx.fill();

        // Particle Core
        ctx.fillStyle = p.tunneling ? '#f87171' : 'var(--indigo)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Velocity / Target Tendril towards mbest
        ctx.strokeStyle = 'rgba(120, 140, 220, 0.08)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(state.mbest.x, state.mbest.y);
        ctx.stroke();
      });

      // Draw Global Best Particle
      if (state.gbest.energy < 900) {
        ctx.strokeStyle = '#33E1E8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.gbest.x, state.gbest.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Chaos Pulse Shockwave effect
      if (state.chaosPulseActive) {
        ctx.strokeStyle = 'rgba(139, 108, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, (state.pulseTimer / 10) * w * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [running, alpha, chaosEnabled, barrierHeight]);

  const handleReset = () => {
    initParticles(swarmSize);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      height: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* ── Top Bar ── */}
      <div className="glass-card" style={{
        padding: '12px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--indigo) 0%, var(--violet) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px rgba(108, 123, 255, 0.45)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <Atom size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-heading)' }}>
              Quantum State Canvas & Particle Swarm Phase Space
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(51, 225, 232, 0.15)', color: 'var(--cyan)', fontWeight: 700, border: '1px solid rgba(51, 225, 232, 0.3)', fontFamily: 'var(--font-heading)' }}>
                Live 60 FPS Swarm Simulation
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Visualizing Quantum Delta Well tunneling, mean-best attractors, and logistic chaos perturbation
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleReset}
            className="btn-quantum-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={13} /> Reset Swarm
          </button>
          <button
            onClick={() => setRunning(!running)}
            className="btn-quantum-primary"
            style={{ padding: '6px 16px', fontSize: '0.80rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'Pause Swarm' : 'Resume Swarm'}
          </button>
        </div>
      </div>

      {/* ── Main Canvas View & Parameter Sidebar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: '12px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Left: Canvas & Telemetry */}
        <div className="glass-card" style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* KPI Ribbon */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            flexShrink: 0
          }}>
            <div style={{ background: 'var(--panel-2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600 }}>Iteration</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>#{iteration}</div>
            </div>
            <div style={{ background: 'var(--panel-2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600 }}>Global Best Energy</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>{globalBestEnergy}</div>
            </div>
            <div style={{ background: 'var(--panel-2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600 }}>Tunneling Events</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--indigo)', fontFamily: 'var(--font-heading)' }}>{tunnelEvents}</div>
            </div>
            <div style={{ background: 'var(--panel-2)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontWeight: 600 }}>Chaos Pulses</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--violet)', fontFamily: 'var(--font-heading)' }}>{chaosPulses}</div>
            </div>
          </div>

          {/* HTML5 Canvas Container */}
          <div style={{
            flex: 1,
            borderRadius: '10px',
            overflow: 'hidden',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            position: 'relative'
          }}>
            <canvas
              ref={canvasRef}
              width={700}
              height={380}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>

        {/* Right: Quantum Hyperparameter Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto' }}>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
              <Sliders size={16} style={{ color: 'var(--indigo)' }} /> Quantum Hyperparameters
            </div>

            {/* Slider 1: Alpha Contraction Coefficient */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Alpha Contraction (α):</span>
                <strong style={{ color: 'var(--indigo)', fontFamily: 'var(--font-heading)' }}>{alpha}</strong>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.2"
                step="0.05"
                value={alpha}
                onChange={e => setAlpha(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--indigo)' }}
              />
              <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>
                Controls potential well expansion width & quantum probability cloud.
              </span>
            </div>

            {/* Slider 2: Swarm Size N */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Swarm Size (N):</span>
                <strong style={{ color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>{swarmSize} particles</strong>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={swarmSize}
                onChange={e => setSwarmSize(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--indigo)' }}
              />
            </div>

            {/* Slider 3: Barrier Height */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Local Trap Barrier Height:</span>
                <strong style={{ color: 'rgba(239, 68, 68, 0.9)', fontFamily: 'var(--font-heading)' }}>{barrierHeight} V(x)</strong>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                step="5"
                value={barrierHeight}
                onChange={e => setBarrierHeight(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--indigo)' }}
              />
            </div>

            {/* Ablation Switches */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Ablation Layer Switches</div>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={chaosEnabled}
                  onChange={e => setChaosEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--indigo)' }}
                />
                <span>⚡ Logistic Chaos Map Escape</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={twoOptEnabled}
                  onChange={e => setTwoOptEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--indigo)' }}
                />
                <span>🔄 2-Opt Edge-Crossing Polisher</span>
              </label>
            </div>
          </div>

          {/* Theory Explainer Card */}
          <div className="glass-card" style={{ padding: '14px', fontSize: '0.70rem', color: 'var(--text-dim)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-heading)' }}>Quantum Potential Well Equation:</strong>
            <code style={{ background: 'var(--panel-2)', padding: '4px 6px', borderRadius: '4px', color: 'var(--cyan)', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-heading)', border: '1px solid var(--border)' }}>
              x(t+1) = p ± α |mbest - x(t)| · ln(1/u)
            </code>
            Unlike classical velocity clamping, quantum particles exist across a probability wave packet, enabling spontaneous tunneling through high potential barriers.
          </div>
        </div>
      </div>
    </div>
  );
}
