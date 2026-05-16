'use client';

import { useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────
interface Step {
  target: string;       // data-tour value to spotlight
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

// ── Tour Steps ────────────────────────────────────────────────
const STEPS: Step[] = [
  {
    target: 'wallet',
    title: '01 — Your Wallet',
    body: 'Your connected address is shown here. The glowing dot confirms you\'re live on-chain. Click ✕ to disconnect at any time.',
    position: 'bottom',
  },
  {
    target: 'stats',
    title: '02 — Portfolio Stats',
    body: 'Real-time overview: active trades, ETH locked in escrow, and overdue contracts awaiting penalty enforcement.',
    position: 'bottom',
  },
  {
    target: 'create-form',
    title: '03 — Create a Trade',
    body: 'Set the seller address, escrow amount in ETH, and a deadline. The contract holds funds until delivery is confirmed or the deadline expires.',
    position: 'bottom',
  },
  {
    target: 'demo-toggle',
    title: '04 — Demo Mode',
    body: 'Toggle between Demo (seconds countdown — perfect for presentations) and Production (days). Set 30 seconds, fund the trade, and watch the ring drain live.',
    position: 'bottom',
  },
  {
    target: 'ledger',
    title: '05 — The Active Ledger',
    body: 'Every trade you\'re involved in appears here — as buyer or seller. The state machine tracks: Created → Funded → In Transit → Delivered → Completed.',
    position: 'top',
  },
  {
    target: 'privacy',
    title: '06 — Privacy Mode',
    body: 'Toggle to blur all amounts and addresses. Essential when presenting to a live audience — keeps sensitive data hidden on screen.',
    position: 'top',
  },
  {
    target: 'countdown',
    title: '07 — Live Countdown Ring',
    body: 'Each trade has a live ring that drains in real time. Green → Orange (last 30s) → Red (overdue). When it hits zero the ⚡ Slash button activates automatically.',
    position: 'left',
  },
];

// ── Helpers ───────────────────────────────────────────────────
function getRect(target: string): DOMRect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  return el ? el.getBoundingClientRect() : null;
}

const PAD = 10; // spotlight padding

// ── Main Component ────────────────────────────────────────────
export function OnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep]     = useState(0);
  const [rect, setRect]     = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const current = STEPS[step];

  // Track the spotlight target dynamically
  useEffect(() => {
    setVisible(false);
    let tries = 0;

    const find = () => {
      const r = getRect(current.target);
      if (r) {
        setRect(r);
        setTimeout(() => setVisible(true), 60);
      } else if (tries++ < 20) {
        rafRef.current = requestAnimationFrame(find);
      } else {
        // Element not found — skip to center mode
        setRect(null);
        setTimeout(() => setVisible(true), 60);
      }
    };

    rafRef.current = requestAnimationFrame(find);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, current.target]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const finish = () => {
    localStorage.setItem('il-tour-v1', '1');
    onComplete();
  };

  // Tooltip position calculation
  const tooltip = computeTooltip(rect, current.position);

  const C = {
    accent: '#b8ff00',
    danger: '#ff3535',
    bg:     '#080909',
    surface:'#0f1011',
    border: 'rgba(255,255,255,0.08)',
    text:   '#ddd9d0',
    dim:    'rgba(255,255,255,0.35)',
    mono:   "'DM Mono','Courier New',monospace",
    serif:  "'DM Serif Display',Georgia,serif",
  };

  // SVG spotlight mask
  const spotlight = rect
    ? { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD*2, h: rect.height + PAD*2 }
    : { x: 0, y: 0, w: 0, h: 0 };

  return (
    <>
      {/* Backdrop with cutout */}
      <div style={{ position:'fixed', inset:0, zIndex:9000, pointerEvents:'all' }} onClick={e => e.stopPropagation()}>
        <svg
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', transition:'opacity 0.3s', opacity: visible ? 1 : 0 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="il-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={spotlight.x}
                  y={spotlight.y}
                  width={spotlight.w}
                  height={spotlight.h}
                  rx="6"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(8,9,9,0.82)"
            mask="url(#il-tour-mask)"
            style={{ backdropFilter:'blur(2px)' }}
          />
          {/* Spotlight border glow */}
          {rect && (
            <rect
              x={spotlight.x - 1}
              y={spotlight.y - 1}
              width={spotlight.w + 2}
              height={spotlight.h + 2}
              rx="7"
              fill="none"
              stroke={C.accent}
              strokeWidth="1.5"
              opacity={visible ? 0.6 : 0}
              style={{ transition:'opacity 0.4s' }}
            />
          )}
        </svg>

        {/* Tooltip card */}
        <div
          style={{
            position: 'fixed',
            ...tooltip,
            width: '300px',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '22px 24px',
            zIndex: 9001,
            boxShadow: `0 0 0 1px rgba(184,255,0,0.08), 0 24px 60px rgba(0,0,0,0.7)`,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.25s, transform 0.25s',
            fontFamily: C.mono,
          }}
        >
          {/* Progress dots */}
          <div style={{ display:'flex', gap:'5px', marginBottom:'16px' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '100px',
                  background: i === step ? C.accent : i < step ? 'rgba(184,255,0,0.3)' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* Title */}
          <div style={{ fontSize:'10px', letterSpacing:'0.2em', color:C.accent, textTransform:'uppercase', fontWeight:600, marginBottom:'8px' }}>
            {current.title}
          </div>

          {/* Body */}
          <p style={{ fontSize:'13px', color:C.text, lineHeight:1.7, margin:'0 0 20px', fontFamily:C.mono }}>
            {current.body}
          </p>

          {/* Nav */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button
              onClick={finish}
              style={{ background:'none', border:'none', color:C.dim, fontSize:'11px', cursor:'pointer', fontFamily:C.mono, letterSpacing:'0.1em', padding:0, textTransform:'uppercase' }}
            >
              Skip tour
            </button>
            <div style={{ display:'flex', gap:'8px' }}>
              {step > 0 && (
                <button
                  onClick={prev}
                  style={{ padding:'8px 16px', background:'transparent', border:`1px solid ${C.border}`, color:C.dim, borderRadius:'4px', fontSize:'12px', cursor:'pointer', fontFamily:C.mono, letterSpacing:'0.06em' }}
                >
                  ← Back
                </button>
              )}
              <button
                onClick={next}
                style={{ padding:'8px 20px', background:C.accent, color:'#080909', border:'none', borderRadius:'4px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:C.mono, letterSpacing:'0.08em', textTransform:'uppercase' }}
              >
                {step === STEPS.length - 1 ? 'Done ✓' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes il-glow {
          0%,100% { opacity:0.5; }
          50%      { opacity:1;   }
        }
      `}</style>
    </>
  );
}

// ── Tour Trigger Button ───────────────────────────────────────
export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Start guided tour"
      style={{
        position: 'fixed',
        bottom: '28px',
        right:  '28px',
        zIndex:  8999,
        width:  '42px',
        height: '42px',
        borderRadius: '50%',
        background: 'rgba(15,16,17,0.95)',
        border: '1px solid rgba(184,255,0,0.25)',
        color:  '#b8ff00',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 20px rgba(184,255,0,0.1)',
        fontFamily: "'DM Mono','Courier New',monospace",
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(184,255,0,0.3)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(184,255,0,0.6)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(184,255,0,0.1)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(184,255,0,0.25)';
      }}
    >
      ?
    </button>
  );
}

// ── Position Calculator ───────────────────────────────────────
function computeTooltip(
  rect: DOMRect | null,
  position: Step['position'] = 'bottom'
): React.CSSProperties {
  const TW = 300; // tooltip width
  const TH = 220; // tooltip height estimate
  const GAP = 18;
  const VW = typeof window !== 'undefined' ? window.innerWidth  : 1200;
  const VH = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (!rect || position === 'center') {
    // Centered fallback
    return {
      top:  '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Try preferred position, fall back if out of viewport
  const positions: Record<string, React.CSSProperties> = {
    bottom: {
      top:  Math.min(rect.bottom + GAP, VH - TH - 16),
      left: Math.max(16, Math.min(rect.left, VW - TW - 16)),
    },
    top: {
      top:  Math.max(16, rect.top - TH - GAP),
      left: Math.max(16, Math.min(rect.left, VW - TW - 16)),
    },
    right: {
      top:  Math.max(16, rect.top),
      left: Math.min(rect.right + GAP, VW - TW - 16),
    },
    left: {
      top:  Math.max(16, rect.top),
      left: Math.max(16, rect.left - TW - GAP),
    },
  };

  return positions[position] ?? positions.bottom;
}