import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  BarChart2, 
  Trophy,
  Volume2,
  VolumeX,
  Keyboard
} from 'lucide-react';

import DemoTimelineView from './DemoTimelineView';
import BenchmarkView from './BenchmarkView';
import GhostRaceArena from './GhostRaceArena';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import { isAudioEnabled, setAudioEnabled, playClickTick } from './audioUtils';

const ATOM_POSITIONS = (() => {
  const atoms = [];
  let seed = 4281;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (let i = 0; i < 68; i++) {
    const x = Math.round(pseudoRandom() * 1880 + 20);
    const y = Math.round(pseudoRandom() * 1040 + 20);
    const scale = +(0.14 + pseudoRandom() * 0.14).toFixed(3);
    const opacity = +(0.12 + pseudoRandom() * 0.20).toFixed(3);
    const rot = Math.round(pseudoRandom() * 180);
    atoms.push({ id: i, x, y, scale, opacity, rot });
  }
  return atoms;
})();

export default function App() {
  const [activeTab, setActiveTab] = useState("demo");
  const [audioOn, setAudioOn] = useState(() => isAudioEnabled());
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    setAudioEnabled(next);
    if (next) playClickTick();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
        return;
      }

      if (e.key === '?' || (e.key === 'h' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
      } else if (e.key === '1') {
        setActiveTab('demo');
        playClickTick();
      } else if (e.key === '2') {
        setActiveTab('race');
        playClickTick();
      } else if (e.key === '3') {
        setActiveTab('benchmark');
        playClickTick();
      } else if (e.code === 'Space') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('qray-hotkey', { detail: 'toggle-play' }));
      } else if (e.key === 'r' || e.key === 'R') {
        window.dispatchEvent(new CustomEvent('qray-hotkey', { detail: 'restart' }));
      } else if (e.key === 't' || e.key === 'T') {
        window.dispatchEvent(new CustomEvent('qray-hotkey', { detail: 'toggle-traffic' }));
      } else if (e.key === 's' || e.key === 'S') {
        window.dispatchEvent(new CustomEvent('qray-hotkey', { detail: 'open-sandbox' }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ 
      padding: '10px 18px', 
      maxWidth: '1720px', 
      margin: '0 auto', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative'
    }}>

      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden'
      }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <defs>
            <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5A6AF5" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#7A5AF0" stopOpacity="0.1" />
            </linearGradient>
            <pattern id="hexLattice" width="28" height="48.497" patternUnits="userSpaceOnUse">
              <path d="M 14 0 L 28 8.083 L 28 24.249 L 14 32.332 L 0 24.249 L 0 8.083 Z M 14 32.332 L 28 40.415 L 28 56.58 L 14 64.664 L 0 56.58 L 0 40.415 Z" fill="none" stroke="rgba(100,120,200,0.12)" strokeWidth="0.8" />
            </pattern>
            <g id="atom">
              <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="none" stroke="#2BC9D6" strokeWidth="1.2" />
              <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="none" stroke="#5A6AF5" strokeWidth="1.2" transform="rotate(60)" />
              <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="none" stroke="#7A5AF0" strokeWidth="1.2" transform="rotate(120)" />
              <circle cx="0" cy="0" r="1.8" fill="#5A6AF5" />
            </g>
          </defs>

          <rect width="100%" height="100%" fill="url(#hexLattice)" opacity="0.25" />

          {ATOM_POSITIONS.map(atom => (
            <use
              key={atom.id}
              href="#atom"
              transform={`translate(${atom.x} ${atom.y}) rotate(${atom.rot}) scale(${atom.scale})`}
              opacity={atom.opacity}
            />
          ))}

          <g transform="translate(1600, 40)" opacity="0.38">
            <g className="quantum-orbit-ring">
              <ellipse cx="0" cy="0" rx="180" ry="70" fill="none" stroke="url(#orbitGrad)" strokeWidth="1.2" strokeDasharray="8 8" />
              <ellipse cx="0" cy="0" rx="180" ry="70" fill="none" stroke="rgba(43,201,216,0.5)" strokeWidth="1" transform="rotate(60)" strokeDasharray="6 10" />
              <ellipse cx="0" cy="0" rx="180" ry="70" fill="none" stroke="rgba(122,90,240,0.4)" strokeWidth="1" transform="rotate(120)" />
              <circle cx="0" cy="0" r="4" fill="#5A6AF5" filter="drop-shadow(0 0 8px #5A6AF5)" />
            </g>
          </g>

          <g transform="translate(80, 950)" opacity="0.35">
            <g className="quantum-orbit-ring-fast">
              <ellipse cx="0" cy="0" rx="190" ry="75" fill="none" stroke="rgba(90,106,245,0.45)" strokeWidth="1.2" strokeDasharray="12 12" />
              <ellipse cx="0" cy="0" rx="190" ry="75" fill="none" stroke="rgba(43,201,216,0.4)" strokeWidth="1" transform="rotate(60)" strokeDasharray="4 8" />
              <ellipse cx="0" cy="0" rx="190" ry="75" fill="none" stroke="rgba(122,90,240,0.35)" strokeWidth="1" transform="rotate(120)" />
              <circle cx="0" cy="0" r="3.5" fill="#2BC9D6" filter="drop-shadow(0 0 6px #2BC9D6)" />
            </g>
          </g>
        </svg>

        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(2, 3, 8, 0.85) 100%)',
          pointerEvents: 'none'
        }} />
      </div>
      
      <header className="stagger-enter-1" style={{ 
        padding: '2px 0 10px 0', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        marginBottom: '8px',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px', 
            background: 'linear-gradient(135deg, var(--indigo) 0%, var(--violet) 100%)', 
            color: '#ffffff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 700, 
            fontSize: '1.25rem',
            fontFamily: 'var(--font-heading)',
            boxShadow: '0 0 20px rgba(108,123,255,0.45)',
            border: '1px solid rgba(255,255,255,0.25)'
          }}>
            Q
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                QRay
              </h1>
              <span style={{ 
                fontSize: '0.68rem', 
                padding: '1px 8px', 
                borderRadius: '4px', 
                background: 'rgba(90, 106, 245, 0.12)', 
                color: 'var(--indigo)', 
                fontWeight: 700, 
                border: '1px solid rgba(90, 106, 245, 0.3)',
                fontFamily: 'var(--font-heading)'
              }}>
                v5 Quantum Fleet Engine
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.70rem', color: 'var(--text-dim)' }}>
              Real-Time Dynamic Traffic Navigation & Multi-Scale Empirical Benchmarking
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <nav style={{ 
            display: 'flex', 
            gap: '5px', 
            background: 'var(--panel)', 
            padding: '4px', 
            borderRadius: '10px', 
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}>
            <button 
              id="nav-simulation-tab"
              onClick={() => { setActiveTab("demo"); playClickTick(); }}
              className={activeTab === 'demo' ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
              style={{ 
                padding: '6px 14px', 
                fontSize: '0.80rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer',
                border: activeTab === 'demo' ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'
              }}
            >
              <Activity size={14} style={{ color: activeTab === 'demo' ? '#fff' : 'var(--indigo)' }} />
              <span>Simulation & Sandbox</span>
            </button>

            <button 
              id="nav-race-tab"
              onClick={() => { setActiveTab("race"); playClickTick(); }}
              className={activeTab === 'race' ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
              style={{ 
                padding: '6px 14px', 
                fontSize: '0.80rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer',
                border: activeTab === 'race' ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'
              }}
            >
              <Trophy size={14} style={{ color: activeTab === 'race' ? '#fff' : 'var(--violet)' }} />
              <span>Ghost Race Duel</span>
            </button>

            <button 
              id="nav-benchmark-tab"
              onClick={() => { setActiveTab("benchmark"); playClickTick(); }}
              className={activeTab === 'benchmark' ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
              style={{ 
                padding: '6px 14px', 
                fontSize: '0.80rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer',
                border: activeTab === 'benchmark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'
              }}
            >
              <BarChart2 size={14} style={{ color: activeTab === 'benchmark' ? '#fff' : 'var(--indigo)' }} />
              <span>Empirical Benchmarks</span>
            </button>
          </nav>

          <button
            id="btn-toggle-audio"
            onClick={toggleAudio}
            className="btn-quantum-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: audioOn ? 'rgba(43, 201, 216, 0.12)' : 'var(--panel)',
              color: audioOn ? 'var(--cyan)' : 'var(--text-faint)'
            }}
            title={audioOn ? 'Audio Synthesizer: ON (Click to Mute)' : 'Audio Synthesizer: MUTED (Click to Enable)'}
          >
            {audioOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span style={{ fontSize: '0.70rem', fontWeight: 600 }}>{audioOn ? 'Sound' : 'Muted'}</span>
          </button>

          <button
            id="btn-open-hotkeys"
            onClick={() => { setIsShortcutsOpen(true); playClickTick(); }}
            className="btn-quantum-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text-dim)'
            }}
            title="Keyboard Shortcuts & Hotkeys Guide (? key)"
          >
            <Keyboard size={14} style={{ color: 'var(--indigo)' }} />
            <span style={{ fontSize: '0.70rem', fontWeight: 600 }}>[ ? ]</span>
          </button>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {activeTab === "demo" && <DemoTimelineView />}
        {activeTab === "race" && <GhostRaceArena />}
        {activeTab === "benchmark" && <BenchmarkView />}
      </main>

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

    </div>
  );
}
