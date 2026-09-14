import React from 'react';
import { X, Command, Play, RotateCcw, AlertTriangle, Zap, BarChart2, Trophy, HelpCircle } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause simulation playback', icon: <Play size={14} style={{ color: 'var(--cyan)' }} /> },
    { key: 'R', desc: 'Restart timeline to 08:00 AM', icon: <RotateCcw size={14} style={{ color: 'var(--indigo)' }} /> },
    { key: '1', desc: 'Navigate to Simulation & Sandbox', icon: <Play size={14} style={{ color: 'var(--indigo)' }} /> },
    { key: '2', desc: 'Navigate to Ghost Race Duel', icon: <Trophy size={14} style={{ color: 'var(--violet)' }} /> },
    { key: '3', desc: 'Navigate to Empirical Benchmarks', icon: <BarChart2 size={14} style={{ color: 'var(--indigo)' }} /> },
    { key: 'T', desc: 'Simulate / Toggle Traffic Incident Alert', icon: <AlertTriangle size={14} style={{ color: '#ef4444' }} /> },
    { key: 'S', desc: 'Open Disruption Sandbox Modal', icon: <Zap size={14} style={{ color: 'var(--violet)' }} /> },
    { key: '?', desc: 'Toggle this Hotkeys HUD guide', icon: <HelpCircle size={14} style={{ color: 'var(--cyan)' }} /> },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 3, 8, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeInDown 0.2s ease'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--panel-2)',
          border: '1px solid rgba(100, 120, 200, 0.25)',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7), 0 0 30px rgba(90, 106, 245, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--indigo) 0%, var(--violet) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 12px rgba(90, 106, 245, 0.4)'
            }}>
              <Command size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                Keyboard Shortcuts & Control HUD
              </h3>
              <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                Quick navigation & real-time dispatch triggers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--panel)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text)' }}>
                {item.icon}
                <span>{item.desc}</span>
              </div>
              <kbd
                style={{
                  background: 'var(--panel-2)',
                  border: '1px solid rgba(100, 120, 200, 0.35)',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--cyan)',
                  fontFamily: 'monospace',
                  minWidth: '24px',
                  textAlign: 'center'
                }}
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--panel)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.68rem',
          color: 'var(--text-faint)'
        }}>
          <span>Press <kbd style={{ color: 'var(--text)', background: 'var(--panel-2)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)' }}>Esc</kbd> or click outside to dismiss</span>
          <button
            onClick={onClose}
            className="btn-quantum-primary"
            style={{ padding: '5px 14px', fontSize: '0.74rem' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
