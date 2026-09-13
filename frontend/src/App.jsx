import React, { useState } from 'react';
import { 
  Activity, 
  BarChart2, 
  Sparkles
} from 'lucide-react';

import DemoTimelineView from './DemoTimelineView';
import BenchmarkView from './BenchmarkView';

export default function App() {
  const [activeTab, setActiveTab] = useState("demo"); // 'demo' (Simulation) or 'benchmark'

  return (
    <div style={{ 
      padding: '12px 20px', 
      maxWidth: '1650px', 
      margin: '0 auto', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      
      {/* ── Top Navigation Header ── */}
      <header style={{ 
        padding: '2px 0 10px 0', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '34px', 
            height: '34px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)', 
            color: '#000000', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 900, 
            fontSize: '1.2rem',
            boxShadow: '0 0 16px rgba(255,255,255,0.25)'
          }}>
            Q
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: '#ffffff' }}>
                QRay
              </h1>
              <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: '4px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 800, border: '1px solid rgba(56,189,248,0.3)' }}>
                v5 Quantum Routing Engine
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.70rem', color: '#71717a' }}>
              Real-Time Dynamic Traffic Navigation & Multi-Scale Empirical Benchmarking
            </p>
          </div>
        </div>
        
        {/* Navigation Tabs: ONLY Simulation and Benchmark */}
        <nav style={{ display: 'flex', gap: '8px', background: '#09090b', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)' }}>
          <button 
            id="nav-simulation-tab"
            onClick={() => setActiveTab("demo")}
            className={activeTab === 'demo' ? 'btn-material-white' : 'btn-material-outline'}
            style={{ 
              padding: '7px 18px', 
              fontSize: '0.82rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '7px',
              cursor: 'pointer',
              border: activeTab === 'demo' ? 'none' : '1px solid transparent'
            }}
          >
            <Activity size={15} style={{ color: activeTab === 'demo' ? '#000' : '#38bdf8' }} />
            <span>Simulation</span>
          </button>

          <button 
            id="nav-benchmark-tab"
            onClick={() => setActiveTab("benchmark")}
            className={activeTab === 'benchmark' ? 'btn-material-white' : 'btn-material-outline'}
            style={{ 
              padding: '7px 18px', 
              fontSize: '0.82rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '7px',
              cursor: 'pointer',
              border: activeTab === 'benchmark' ? 'none' : '1px solid transparent'
            }}
          >
            <BarChart2 size={15} style={{ color: activeTab === 'benchmark' ? '#000' : '#34d399' }} />
            <span>Benchmark Results</span>
          </button>
        </nav>
      </header>

      {/* Main Content View Container */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* PAGE 1: Live Dynamic Traffic Simulation (Google Maps Style) */}
        {activeTab === "demo" && <DemoTimelineView />}

        {/* PAGE 2: Benchmark Results Page (empirical_results.md) */}
        {activeTab === "benchmark" && <BenchmarkView />}
      </main>

    </div>
  );
}
