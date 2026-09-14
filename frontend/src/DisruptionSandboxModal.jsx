import React, { useState } from 'react';
import { 
  AlertTriangle, CloudRain, ShieldAlert, Zap, 
  MapPin, X, ArrowRight, CheckCircle2, RotateCcw
} from 'lucide-react';

const DISRUPTION_TYPES = [
  {
    id: 'flood',
    title: 'Monsoon Flash Flood / Waterlogging',
    icon: CloudRain,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.4)',
    desc: 'Severe road flooding blocks major low-lying arterial corridors.',
    severity: 'High (80% Speed Reduction)'
  },
  {
    id: 'collapse',
    title: 'Metro Excavation / Road Cavity',
    icon: AlertTriangle,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    desc: 'Emergency barricades block lane; zero transit allowed through intersection.',
    severity: 'Critical (Full Closure)'
  },
  {
    id: 'vip',
    title: 'VIP Convoy & Green Corridor',
    icon: ShieldAlert,
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.4)',
    desc: 'Priority police motorcade locks intersection for 25 minutes.',
    severity: 'Moderate (Time-Window Delay)'
  },
  {
    id: 'surge',
    title: 'Emergency Medical / Port Demand Surge',
    icon: Zap,
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.15)',
    border: 'rgba(192, 132, 252, 0.4)',
    desc: 'Sudden +40 unit urgent cargo request requires immediate vehicle re-balancing.',
    severity: 'Dynamic Capacity Reassignment'
  }
];

export default function DisruptionSandboxModal({
  isOpen,
  onClose,
  stops = [],
  onApplyDisruption,
  activeDisruption = null,
  onClearDisruption
}) {
  const [selectedType, setSelectedType] = useState('flood');
  const [selectedStopId, setSelectedStopId] = useState(stops.find(s => !s.isDepot)?.id || 2);

  if (!isOpen) return null;

  const handleApply = () => {
    const typeObj = DISRUPTION_TYPES.find(t => t.id === selectedType);
    const stopObj = stops.find(s => s.id === Number(selectedStopId));
    if (!stopObj) return;

    onApplyDisruption({
      type: selectedType,
      typeInfo: typeObj,
      stopId: Number(selectedStopId),
      stopName: stopObj.name,
      lat: stopObj.lat,
      lng: stopObj.lng,
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 9, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--panel-2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(139, 108, 255, 0.2)',
              border: '1px solid rgba(139, 108, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--violet)'
            }}>
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                Disruption Sandbox: Chaos God Mode
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Inject urban disturbances & evaluate Quantum warm-restart routing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-faint)',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Step 1: Select Hazard Type */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-heading)' }}>
              1. Select Urban Incident Scenario:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {DISRUPTION_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <div
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: isSelected ? 'rgba(108, 123, 255, 0.18)' : 'var(--panel-2)',
                      border: isSelected ? '2px solid var(--indigo)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} style={{ color: type.color }} />
                      <span style={{ fontSize: '0.80rem', fontWeight: 700, color: isSelected ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'var(--font-heading)' }}>
                        {type.title}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-dim)', lineHeight: 1.3 }}>
                      {type.desc}
                    </p>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      color: type.color,
                      marginTop: 'auto',
                      paddingTop: '4px',
                      fontFamily: 'var(--font-heading)'
                    }}>
                      {type.severity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Target Location Selection */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
              <MapPin size={14} style={{ color: 'var(--indigo)' }} /> 2. Target Delivery Stop / Intersection:
            </label>
            <select
              value={selectedStopId}
              onChange={e => setSelectedStopId(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--panel-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {stops.filter(s => !s.isDepot && s.enabled).map(s => (
                <option key={s.id} value={s.id}>
                  Stop #{s.id} — {s.name} ({s.demand} units)
                </option>
              ))}
            </select>
          </div>

          {/* Active status or Reset option */}
          {activeDisruption && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>
                Currently active: <strong>{activeDisruption.stopName}</strong>
              </div>
              <button
                onClick={() => {
                  onClearDisruption();
                  onClose();
                }}
                className="btn-quantum-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#fca5a5',
                  borderColor: 'rgba(239, 68, 68, 0.4)'
                }}
              >
                <RotateCcw size={12} /> Clear Disruption
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          background: 'var(--panel-2)'
        }}>
          <button
            onClick={onClose}
            className="btn-quantum-secondary"
            style={{ padding: '8px 16px', fontSize: '0.80rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="btn-quantum-primary"
            style={{
              padding: '8px 18px',
              fontSize: '0.80rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Zap size={14} /> Inject Disturbance & Reroute
          </button>
        </div>
      </div>
    </div>
  );
}
