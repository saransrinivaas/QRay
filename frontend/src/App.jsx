import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  BarChart2, 
  Compass,
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
    const scale = +(0.12 + pseudoRandom() * 0.10).toFixed(3);
    const opacity = +(0.06 + pseudoRandom() * 0.10).toFixed(3); // Muted, non-glowing
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
      position: 'relative',
      background: 'var(--bg)'
    }}>

      {/* ── Deep Dark Quantum Background (Muted, Matte, No Light Flares) ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden'
      }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <defs>
            <pattern id="hexLattice" width="28" height="48.497" patternUnits="userSpaceOnUse">
              <path d="M 14 0 L 28 8.083 L 28 24.249 L 14 32.332 L 0 24.249 L 0 8.083 Z M 14 32.332 L 28 40.415 L 28 56.58 L 14 64.664 L 0 56.58 L 0 40.415 Z" fill="none" stroke="rgba(100,120,200,0.08)" strokeWidth="0.8" />
            </pattern>
            <g id="atom">
              <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="none" stroke="rgba(43,201,216,0.4)" strokeWidth="1" />
              <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="none" stroke="rgba(90,106,245,0.4)" strokeWidth="1" transform="rotate(60)" />
              <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="none" stroke="rgba(122,90,240,0.3)" strokeWidth="1" transform="rotate(120)" />
              <circle cx="0" cy="0" r="1.5" fill="#4F46E5" />
            </g>
          </defs>

          {/* Deep dark lattice */}
          <rect width="100%" height="100%" fill="url(#hexLattice)" opacity="0.18" />

          {/* Stealth quantum nodes */}
          {ATOM_POSITIONS.map(atom => (
            <use
              key={atom.id}
              href="#atom"
              transform={`translate(${atom.x} ${atom.y}) rotate(${atom.rot}) scale(${atom.scale})`}
              opacity={atom.opacity}
            />
          ))}

          {/* Upper orbital structure — matte, no drop-shadow lights */}
          <g transform="translate(1600, 40)" opacity="0.22">
            <g className="quantum-orbit-ring">
              <ellipse cx="0" cy="0" rx="180" ry="70" fill="none" stroke="rgba(90,106,245,0.35)" strokeWidth="1" strokeDasharray="8 8" />
              <ellipse cx="0" cy="0" rx="180" ry="70" fill="none" stroke="rgba(43,201,216,0.3)" strokeWidth="1" transform="rotate(60)" strokeDasharray="6 10" />
              <ellipse cx="0" cy="0" rx="180" ry="70" fill="none" stroke="rgba(122,90,240,0.25)" strokeWidth="1" transform="rotate(120)" />
              <circle cx="0" cy="0" r="3" fill="#4F46E5" />
            </g>
          </g>

          {/* Lower orbital structure — matte, no drop-shadow lights */}
          <g transform="translate(80, 950)" opacity="0.20">
            <g className="quantum-orbit-ring-fast">
              <ellipse cx="0" cy="0" rx="190" ry="75" fill="none" stroke="rgba(90,106,245,0.35)" strokeWidth="1" strokeDasharray="12 12" />
              <ellipse cx="0" cy="0" rx="190" ry="75" fill="none" stroke="rgba(43,201,216,0.25)" strokeWidth="1" transform="rotate(60)" strokeDasharray="4 8" />
              <ellipse cx="0" cy="0" rx="190" ry="75" fill="none" stroke="rgba(122,90,240,0.2)" strokeWidth="1" transform="rotate(120)" />
              <circle cx="0" cy="0" r="3" fill="#0284C7" />
            </g>
          </g>
        </svg>

        {/* Deep dark void vignette */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(2, 3, 8, 0.94) 100%)',
          pointerEvents: 'none'
        }} />
      </div>
      
      {/* ── Console Header (Matte, No glowing halo) ── */}
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
          {/* New Official Q-Ray Emblem */}
          <div style={{ 
            width: '34px', 
            height: '34px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, rgba(55, 48, 163, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '4px',
            boxSizing: 'border-box'
          }}>
            <img 
              src="/qray-logo-white.png" 
              alt="Q-Ray Logo" 
              style={{ width: '24px', height: '24px', objectFit: 'contain', display: 'block' }} 
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                QRay
              </h1>
              <span style={{ 
                fontSize: '0.67rem', 
                padding: '1px 7px', 
                borderRadius: '4px', 
                background: 'rgba(90, 106, 245, 0.10)', 
                color: 'var(--indigo)', 
                fontWeight: 600, 
                border: '1px solid rgba(90, 106, 245, 0.22)',
                fontFamily: 'var(--font-heading)'
              }}>
                Dynamic Routing Console
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-dim)' }}>
              Real-Time Dynamic Traffic Navigation & Multi-Scale Empirical Benchmarking
            </p>
          </div>
        </div>
        
        {/* Navigation Tabs in Deep Dark Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <nav style={{ 
            display: 'flex', 
            gap: '3px', 
            background: 'var(--panel)', 
            padding: '3px', 
            borderRadius: '8px', 
            border: '1px solid var(--border)'
          }}>
            <button 
              id="nav-simulation-tab"
              onClick={() => { setActiveTab("demo"); playClickTick(); }}
              className={activeTab === 'demo' ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
              style={{ 
                padding: '5px 12px', 
                fontSize: '0.78rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Activity size={13} style={{ color: activeTab === 'demo' ? '#fff' : 'var(--text-dim)' }} />
              <span>Simulation & Sandbox</span>
            </button>

            <button 
              id="nav-race-tab"
              onClick={() => { setActiveTab("race"); playClickTick(); }}
              className={activeTab === 'race' ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
              style={{ 
                padding: '5px 12px', 
                fontSize: '0.78rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Compass size={13} style={{ color: activeTab === 'race' ? '#fff' : 'var(--text-dim)' }} />
              <span>Fleet Duel Arena</span>
            </button>

            <button 
              id="nav-benchmark-tab"
              onClick={() => { setActiveTab("benchmark"); playClickTick(); }}
              className={activeTab === 'benchmark' ? 'btn-quantum-primary' : 'btn-quantum-secondary'}
              style={{ 
                padding: '5px 12px', 
                fontSize: '0.78rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <BarChart2 size={13} style={{ color: activeTab === 'benchmark' ? '#fff' : 'var(--text-dim)' }} />
              <span>Empirical Benchmarks</span>
            </button>
          </nav>

          <button
            id="btn-toggle-audio"
            onClick={toggleAudio}
            className="btn-quantum-secondary"
            style={{
              padding: '5px 9px',
              fontSize: '0.72rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: audioOn ? 'rgba(43, 201, 216, 0.12)' : 'var(--panel)',
              color: audioOn ? 'var(--cyan)' : 'var(--text-faint)'
            }}
            title={audioOn ? 'Audio: ON (Click to Mute)' : 'Audio: MUTED (Click to Enable)'}
          >
            {audioOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span style={{ fontSize: '0.68rem', fontWeight: 500 }}>{audioOn ? 'Audio' : 'Mute'}</span>
          </button>

          <button
            id="btn-open-hotkeys"
            onClick={() => { setIsShortcutsOpen(true); playClickTick(); }}
            className="btn-quantum-secondary"
            style={{
              padding: '5px 9px',
              fontSize: '0.72rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text-dim)'
            }}
            title="Keyboard Shortcuts Guide (? key)"
          >
            <Keyboard size={13} style={{ color: 'var(--text-dim)' }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 500 }}>[ ? ]</span>
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
