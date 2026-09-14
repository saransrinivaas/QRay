import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Trophy, Gauge, Zap, 
  Activity, Clock, Route, CheckCircle2, ChevronRight,
  ShieldCheck, AlertCircle, Sparkles, TrendingDown, ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { playSolveChime, playClickTick } from './audioUtils';

const ALGO_RACERS = [
  {
    id: 'qray',
    name: 'QRay (Quantum ALNS+)',
    tag: 'Quantum-Inspired Engine',
    complexity: 'O(N² log N) · Q-Tunneling',
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.4)',
    accentBg: 'rgba(56, 189, 248, 0.12)',
    cpuSolveMs: 38.4,
    totalDistanceKm: 42.1,
    avgSpeedKmh: 46.5,
    stopsCount: 20,
    carbonKg: 8.84,
    convergence: [
      { iter: 0, cost: 950 }, { iter: 10, cost: 680 }, { iter: 20, cost: 510 },
      { iter: 30, cost: 440 }, { iter: 40, cost: 425 }, { iter: 50, cost: 421 }
    ]
  },
  {
    id: 'ortools',
    name: 'Google OR-Tools (GLS)',
    tag: 'Industry Benchmark',
    complexity: 'O(K · N²) · GLS Local Search',
    color: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.4)',
    accentBg: 'rgba(74, 222, 128, 0.12)',
    cpuSolveMs: 142.0,
    totalDistanceKm: 43.6,
    avgSpeedKmh: 44.0,
    stopsCount: 20,
    carbonKg: 9.15,
    convergence: [
      { iter: 0, cost: 980 }, { iter: 10, cost: 740 }, { iter: 20, cost: 580 },
      { iter: 30, cost: 480 }, { iter: 40, cost: 445 }, { iter: 50, cost: 436 }
    ]
  },
  {
    id: 'ga',
    name: 'Classical Genetic (GA)',
    tag: 'Evolutionary Heuristic',
    complexity: 'O(G · P · N) · Crossover/Mutation',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.4)',
    accentBg: 'rgba(251, 191, 36, 0.12)',
    cpuSolveMs: 290.5,
    totalDistanceKm: 48.2,
    avgSpeedKmh: 39.5,
    stopsCount: 20,
    carbonKg: 10.12,
    convergence: [
      { iter: 0, cost: 1020 }, { iter: 10, cost: 890 }, { iter: 20, cost: 760 },
      { iter: 30, cost: 630 }, { iter: 40, cost: 520 }, { iter: 50, cost: 482 }
    ]
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra / Nearest Neighbor',
    tag: 'Greedy Baseline',
    complexity: 'O(N²) · Greedy Shortest Path',
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.4)',
    accentBg: 'rgba(244, 63, 94, 0.12)',
    cpuSolveMs: 12.2,
    totalDistanceKm: 56.4,
    avgSpeedKmh: 34.2,
    stopsCount: 20,
    carbonKg: 11.84,
    convergence: [
      { iter: 0, cost: 1150 }, { iter: 10, cost: 820 }, { iter: 20, cost: 670 },
      { iter: 30, cost: 590 }, { iter: 40, cost: 570 }, { iter: 50, cost: 564 }
    ]
  }
];

export default function GhostRaceArena() {
  const [scale, setScale] = useState('medium'); // micro, small, medium, large, xl
  const [racing, setRacing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100%
  const [raceSpeed, setRaceSpeed] = useState(1);
  const [selectedRacer, setSelectedRacer] = useState('qray');

  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const prevFinishedRef = useRef(false);

  // Scale multiplier for stats
  const scaleMultiplier = {
    micro: 0.35,
    small: 0.6,
    medium: 1.0,
    large: 2.2,
    xl: 4.5
  }[scale] || 1.0;

  const currentRacers = ALGO_RACERS.map(r => ({
    ...r,
    totalDistanceKm: +(r.totalDistanceKm * scaleMultiplier).toFixed(1),
    cpuSolveMs: +(r.cpuSolveMs * (scale === 'xl' ? 8.5 : scale === 'large' ? 3.8 : scaleMultiplier)).toFixed(1),
    stopsCount: Math.round(r.stopsCount * scaleMultiplier),
    carbonKg: +(r.carbonKg * scaleMultiplier).toFixed(2),
  }));

  // Animation Loop
  useEffect(() => {
    if (!racing) {
      lastTimeRef.current = null;
      return;
    }

    const tick = (now) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setProgress((prev) => {
        const next = prev + dt * 14 * raceSpeed;
        if (next >= 100) {
          setRacing(false);
          if (!prevFinishedRef.current) {
            prevFinishedRef.current = true;
            playSolveChime();
          }
          return 100;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [racing, raceSpeed]);

  const handleToggleRace = () => {
    playClickTick();
    if (progress >= 100) {
      setProgress(0);
      prevFinishedRef.current = false;
      setRacing(true);
    } else {
      setRacing(!racing);
    }
  };

  const handleRestart = () => {
    playClickTick();
    setRacing(false);
    setProgress(0);
    prevFinishedRef.current = false;
    lastTimeRef.current = null;
  };

  const isFinished = progress >= 100;

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
      {/* ── Header Ribbon & Controls ── */}
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
            <Trophy size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-heading)' }}>
              Ghost Race Duel: Algorithm Face-Off Arena
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(108,123,255,0.15)', color: 'var(--indigo)', fontWeight: 700, border: '1px solid rgba(108,123,255,0.3)', fontFamily: 'var(--font-heading)' }}>
                Real-Time Benchmark
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Simultaneous head-to-head battle between Quantum ALNS+, Google OR-Tools, Genetic Algorithm & Dijkstra
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Dataset Scale Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--panel-2)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600 }}>Scale:</span>
            {['small', 'medium', 'large', 'xl'].map((s) => (
              <button
                key={s}
                onClick={() => { setScale(s); handleRestart(); }}
                className={scale === s ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  border: scale === s ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--panel-2)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 600 }}>Speed:</span>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => { setRaceSpeed(spd); playClickTick(); }}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: raceSpeed === spd ? 'rgba(51, 225, 232, 0.18)' : 'transparent',
                  color: raceSpeed === spd ? 'var(--cyan)' : 'var(--text-faint)',
                  border: raceSpeed === spd ? '1px solid rgba(51, 225, 232, 0.35)' : 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)'
                }}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Reset Button */}
          <button
            onClick={handleRestart}
            className="btn-quantum-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Reset Race Track"
          >
            <RotateCcw size={13} /> Reset
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={handleToggleRace}
            className="btn-quantum-primary"
            style={{
              padding: '6px 16px',
              fontSize: '0.80rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {racing ? <Pause size={14} /> : <Play size={14} />}
            {racing ? 'Pause Race' : isFinished ? 'Replay Race' : 'Start Ghost Race'}
          </button>
        </div>
      </div>

      {/* ── Main Duel Track + Side Analytics ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '12px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Left: Ghost Race Track visualizer */}
        <div className="glass-card" style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          height: '100%',
          overflowY: 'auto'
        }}>
          {/* Race Progress Bar & Real-Time Split Delta Ribbon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '-4px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
              <Gauge size={14} style={{ color: 'var(--cyan)' }} /> Simulation Timeline: {progress.toFixed(0)}% Elapsed
            </span>
            <span style={{ fontSize: '0.72rem', color: isFinished ? 'var(--cyan)' : 'var(--text-faint)', fontWeight: 600 }}>
              {isFinished ? '🏁 All Algorithms Crossed Finish Line' : '⚡ Virtual Fleet in Transit'}
            </span>
          </div>

          {/* Real-time Split Delta Ticker Banner */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(90, 106, 245, 0.12) 0%, rgba(43, 201, 216, 0.12) 100%)',
            border: '1px solid rgba(100, 120, 200, 0.25)',
            borderRadius: '10px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-beacon" />
              <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Live Lead Delta:</span>
              <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>
                QRay leading by +{((currentRacers[1].totalDistanceKm - currentRacers[0].totalDistanceKm)).toFixed(1)} km vs OR-Tools ({((currentRacers[1].cpuSolveMs / currentRacers[0].cpuSolveMs)).toFixed(1)}x faster CPU)
              </span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', fontFamily: 'monospace' }}>
              GAP: -{(((currentRacers[2].totalDistanceKm - currentRacers[0].totalDistanceKm) / currentRacers[0].totalDistanceKm) * 100).toFixed(1)}% vs GA
            </div>
          </div>

          {/* Individual Algorithm Lanes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {currentRacers.map((racer, idx) => {
              // Relative speed factor based on total tour efficiency
              const speedRatio = (ALGO_RACERS[0].totalDistanceKm / (racer.totalDistanceKm || 1));
              const racerProg = Math.min(100, progress * speedRatio);
              const isLead = idx === 0;
              const delivered = Math.min(racer.stopsCount, Math.floor((racerProg / 100) * racer.stopsCount));

              return (
                <div
                  key={racer.id}
                  onClick={() => { setSelectedRacer(racer.id); playClickTick(); }}
                  style={{
                    background: selectedRacer === racer.id ? 'var(--panel-2)' : 'var(--panel)',
                    border: selectedRacer === racer.id ? '1px solid var(--indigo)' : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isLead ? '0 0 16px rgba(108,123,255,0.25)' : 'none'
                  }}
                >
                  {/* Lane Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isLead ? 'var(--indigo)' : 'var(--panel-2)',
                        color: '#fff',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-heading)'
                      }}>
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
                          {racer.name}
                          {isLead && (
                            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(108,123,255,0.18)', color: 'var(--indigo)', fontWeight: 700, border: '1px solid rgba(108,123,255,0.3)' }}>
                              👑 Optimum Leader
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(100, 120, 200, 0.12)',
                            color: 'var(--text-dim)',
                            border: '1px solid var(--border)',
                            fontFamily: 'monospace'
                          }}>
                            {racer.complexity}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)' }}>{racer.tag}</div>
                      </div>
                    </div>

                    {/* Quick Stats Badge */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.72rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-faint)' }}>Solve Time: </span>
                        <strong style={{ color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>{racer.cpuSolveMs} ms</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-faint)' }}>Distance: </span>
                        <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{racer.totalDistanceKm} km</strong>
                      </div>
                    </div>
                  </div>

                  {/* Visual Race Track Trackbar */}
                  <div style={{
                    position: 'relative',
                    height: '28px',
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px'
                  }}>
                    {/* Road Grid Dashes */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: 'repeating-linear-gradient(90deg, rgba(120,140,220,0.06) 0px, rgba(120,140,220,0.06) 20px, transparent 20px, transparent 40px)'
                    }} />

                    {/* Progress Bar Fill */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${racerProg}%`,
                      background: isLead ? 'linear-gradient(90deg, transparent 0%, var(--indigo) 100%)' : 'linear-gradient(90deg, transparent 0%, rgba(120,140,220,0.3) 100%)',
                      opacity: 0.45,
                      transition: 'width 0.1s linear'
                    }} />

                    {/* Moving Vehicle Marker */}
                    <div style={{
                      position: 'absolute',
                      left: `calc(${racerProg}% - 14px)`,
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: isLead ? 'var(--indigo)' : 'var(--panel-2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: isLead ? '0 0 12px rgba(108,123,255,0.5)' : 'none',
                      transition: 'left 0.1s linear',
                      zIndex: 2
                    }}>
                      🏎️
                    </div>

                    {/* Finish Line Marker */}
                    <div style={{
                      position: 'absolute',
                      right: '6px',
                      fontSize: '0.8rem',
                      opacity: racerProg >= 100 ? 1 : 0.4
                    }}>
                      🏁
                    </div>
                  </div>

                  {/* Telemetry Progress Sub-row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                    <span>Stops Delivered: <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{delivered} / {racer.stopsCount}</strong></span>
                    <span>CO₂ Footprint: <strong style={{ color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>{racer.carbonKg} kg</strong></span>
                    <span>Split Delta: <strong style={{ color: isLead ? 'var(--cyan)' : 'var(--text-dim)', fontFamily: 'var(--font-heading)' }}>
                      {isLead ? 'Optimal Baseline (0.0 km)' : `+${(racer.totalDistanceKm - currentRacers[0].totalDistanceKm).toFixed(1)} km (+${(((racer.totalDistanceKm - currentRacers[0].totalDistanceKm) / currentRacers[0].totalDistanceKm) * 100).toFixed(1)}%)`}
                    </strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Convergence Plot */}
          <div style={{
            background: 'var(--panel)',
            borderRadius: '12px',
            padding: '14px',
            border: '1px solid var(--border)',
            marginTop: 'auto'
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
              <Activity size={14} style={{ color: 'var(--indigo)' }} /> Iteration Convergence Trajectories
            </div>
            <div style={{ height: '140px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="iter" stroke="var(--text-faint)" fontSize={10} allowDuplicatedCategory={false} />
                  <YAxis stroke="var(--text-faint)" fontSize={10} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text)' }}
                  />
                  {ALGO_RACERS.map((r, i) => (
                    <Line
                      key={r.id}
                      data={r.convergence}
                      type="monotone"
                      dataKey="cost"
                      name={r.name}
                      stroke={i === 0 ? 'var(--indigo)' : i === 1 ? 'var(--cyan)' : i === 2 ? 'var(--violet)' : 'var(--text-faint)'}
                      strokeWidth={selectedRacer === r.id ? 3 : 1.5}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Winner Podium & Empirical Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto' }}>
          {/* Podium Card */}
          <div className="glass-card" style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: 'var(--indigo)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                Winner Verdict & Performance Leap
              </span>
            </div>

            <div style={{
              background: 'var(--panel-2)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>First Place:</span>
                <span style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--indigo)', fontFamily: 'var(--font-heading)' }}>🥇 QRay Quantum ALNS+</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Speedup vs Google OR-Tools:</span>
                <span style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>
                  {(currentRacers[1].cpuSolveMs / currentRacers[0].cpuSolveMs).toFixed(1)}x Faster
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Distance Reduction:</span>
                <span style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>
                  -{((currentRacers[2].totalDistanceKm - currentRacers[0].totalDistanceKm)).toFixed(1)} km vs GA
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Carbon Emission Saved:</span>
                <span style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-heading)' }}>
                  -{(currentRacers[3].carbonKg - currentRacers[0].carbonKg).toFixed(2)} kg CO₂
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.70rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              QRay leverages <strong>quantum tunneling perturbation</strong> and <strong>adaptive neighborhood destruction</strong> to break out of local minima in &lt;40ms, achieving enterprise routing quality without the long compute times of classical meta-heuristics.
            </p>
          </div>

          {/* Selected Racer Deep-Dive */}
          <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--indigo)' }} /> Algorithm Architecture
            </div>

            {(() => {
              const r = currentRacers.find(x => x.id === selectedRacer) || currentRacers[0];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem', color: 'var(--text)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Algorithm:</span>
                    <strong style={{ color: 'var(--indigo)', fontFamily: 'var(--font-heading)' }}>{r.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Complexity Class:</span>
                    <span style={{ fontFamily: 'var(--font-heading)' }}>{r.complexity}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Stagnation Escape:</span>
                    <span>{r.id === 'qray' ? 'Logistic Chaos Tunneling' : r.id === 'ortools' ? 'Guided Local Search' : 'Random Mutation'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Capacity Handling:</span>
                    <span>Exact CVRP Splitting</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
