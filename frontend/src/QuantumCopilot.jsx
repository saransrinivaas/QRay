import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, X, MessageSquare, 
  Terminal, ShieldCheck, Zap, Volume2, ArrowRight
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  "Reroute trucks away from flood in Koyambedu",
  "Add 30-unit urgent medical drop at Egmore",
  "Run Ghost Race against Google OR-Tools",
  "Why did QRay choose this specific fleet route?",
  "Calculate total carbon emissions avoided"
];

// Web Audio API chime synthesizer for dispatcher feedback
function playDispatchChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

export default function QuantumCopilot({
  isOpen,
  onClose,
  onTriggerAction,
  activeScenarioInfo = {}
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'copilot',
      text: 'Greetings Commander. I am your Quantum Dispatch Copilot. You can ask me to simulate urban incidents, explain route convergence decisions, or trigger algorithm face-offs.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    playDispatchChime();

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // AI Dispatcher Response Logic
    setTimeout(() => {
      let botReply = '';
      const lower = query.toLowerCase();

      if (lower.includes('flood') || lower.includes('waterlog') || lower.includes('koyambedu')) {
        botReply = '⚡ Quantum Engine recomputed! Shifted Vehicle Beta away from Koyambedu Wholesale Market corridor via Inner Ring Road. Net arrival latency improved by 6.4 minutes with 0 capacity overflow.';
        if (onTriggerAction) onTriggerAction('trigger_flood_koyambedu');
      } else if (lower.includes('urgent') || lower.includes('medical') || lower.includes('egmore')) {
        botReply = '📦 Priority payload injected at Egmore Station. Vehicle Gamma dynamically allocated 30 units capacity with 2-opt route uncrossing.';
        if (onTriggerAction) onTriggerAction('add_emergency_demand');
      } else if (lower.includes('race') || lower.includes('duel') || lower.includes('or-tools') || lower.includes('ortools')) {
        botReply = '🏁 Switching viewport to Ghost Race Arena. Launching synchronized benchmark against Google OR-Tools GLS.';
        if (onTriggerAction) onTriggerAction('switch_tab_race');
      } else if (lower.includes('why') || lower.includes('choose') || lower.includes('decision') || lower.includes('route')) {
        botReply = '🧠 Decision Rationale: Quantum ALNS destroyed high-cost edge overlaps between South and Central Chennai sectors. The quantum tunneling operator jumped over the 14-minute Guindy bottleneck to balance load across 4 vehicles.';
      } else if (lower.includes('carbon') || lower.includes('co2') || lower.includes('esg') || lower.includes('emission')) {
        botReply = '🌿 ESG Audit: Fleet is operating at 94.2% energy efficiency. Avoided 2.34 kg CO₂ emissions and regenerated 4.8 kWh via optimized braking deceleration.';
      } else {
        botReply = `Acknowledged instruction: "${query}". Quantum swarm updated route state and synchronized telemetry.`;
      }

      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'copilot',
          text: botReply
        }
      ]);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '420px',
      height: '520px',
      background: 'var(--panel-glass)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(108, 123, 255, 0.25)',
      backdropFilter: 'blur(16px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeInUp 0.2s ease-out'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--panel-2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--indigo) 0%, var(--violet) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 10px rgba(108, 123, 255, 0.4)'
          }}>
            <Bot size={16} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)' }}>
              Quantum Dispatch Copilot
              <span style={{ fontSize: '0.60rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(51, 225, 232, 0.15)', color: 'var(--cyan)', fontWeight: 700, border: '1px solid rgba(51, 225, 232, 0.3)', fontFamily: 'var(--font-heading)' }}>
                AI Voice & Text
              </span>
            </h4>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            padding: '4px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        padding: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '84%',
              padding: '10px 12px',
              borderRadius: '12px',
              background: msg.sender === 'user' ? 'linear-gradient(135deg, var(--indigo) 0%, var(--violet) 100%)' : 'var(--panel-2)',
              color: msg.sender === 'user' ? '#ffffff' : 'var(--text)',
              border: msg.sender === 'user' ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)',
              fontSize: '0.76rem',
              lineHeight: 1.45,
              fontWeight: msg.sender === 'user' ? 600 : 400,
              boxShadow: msg.sender === 'user' ? '0 4px 15px rgba(108, 123, 255, 0.3)' : 'none'
            }}
          >
            {msg.text}
          </div>
        ))}

        {isTyping && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'var(--panel-2)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
            fontSize: '0.72rem',
            fontStyle: 'italic'
          }}>
            Quantum copilot synthesizing…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Action Chips */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)'
      }}>
        {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            style={{
              whiteSpace: 'nowrap',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontSize: '0.65rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⚡ {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--panel-2)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask Copilot (e.g. 'Reroute away from flood')..."
          style={{
            flex: 1,
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.78rem'
          }}
        />
        <button
          onClick={() => handleSend()}
          className="btn-quantum-primary"
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
