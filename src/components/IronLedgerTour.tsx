'use client';

import { useState, useEffect, useRef } from 'react';

const C = {
  bg:      '#080909',
  surface: '#0f1011',
  border:  'rgba(255,255,255,0.06)',
  accent:  '#b8ff00',
  danger:  '#ff3535',
  text:    '#ddd9d0',
  mid:     'rgba(255,255,255,0.4)',
  dim:     'rgba(255,255,255,0.18)',
  mono:    "'DM Mono','Courier New',monospace",
  serif:   "'DM Serif Display',Georgia,serif",
};

interface TourStep {
  target: string;        // data-tour="..." attribute value
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  accent?: boolean;      // highlight in lime
}

const STEPS: TourStep[] = [
  {
    target: 'header',
    title: 'The Iron Ledger',
    body: 'An autonomous escrow protocol — no lawyers, no banks. Smart contracts hold funds and release them automatically based on cryptographic conditions. Every action is permanent, on-chain, and tamper-proof.',
    placement: 'bottom',
  },
  {
    target: 'stats',
    title: 'Live Ledger Metrics',
    body: 'Real-time stats pulled directly from the blockchain. Active Trades, ETH in Escrow, and Overdue deadlines update every time you interact. Privacy Mode can blur sensitive figures.',
    placement: 'bottom',
  },
  {
    target: 'new-trade',
    title: 'Create a Trade',
    body: 'Fill in the seller address, lock ETH in escrow, and set a deadline. The Penalty field (in basis points) defines how much the seller forfeits if they miss the deadline. 100 bps = 1%.',
    placement: 'bottom',
  },
  {
    target: 'demo-toggle',
    title: 'Demo Mode',
    body: 'Toggle between Demo (seconds) and Production (days) deadlines. In Demo Mode, set a 30-second deadline to watch the countdown ring drain live — no terminal tricks required.',
    placement: 'bottom',
    accent: true,
  },
  {
    target: 'demo-hint',
    title: 'Workflow: Create → Fund → Slash',
    body: '① Set deadline to 30 seconds  ② Click Create Trade  ③ Click Fund Escrow  ④ Watch the ring drain to zero  ⑤ The ⚡ Slash button activates automatically. That\'s the full demo sequence.',
    placement: 'top',
    accent: true,
  },
  {
    target: 'privacy-toggle',
    title: 'Privacy Mode',
    body: 'Blurs all ETH amounts and wallet addresses in the ledger. Useful for presentations where you don\'t want financial details visible to the audience.',
    placement: 'top',
  },
  {
    target: 'active-ledger',
    title: 'Active Ledger',
    body: 'Every trade you\'re involved in appears here — as buyer or seller. Each card shows the full state machine: Created → Funded → InTransit → Delivered → Completed. The ring counts down in real time.',
    placement: 'top',
  },
];

function getTargetRect(target: string): DOMRect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  return el ? el.getBoundingClientRect() : null;
}

function getPopoverPosition(
  rect: DOMRect,
  placement: TourStep['placement'],
  popW: number,
  popH: number
): { top: number; left: number; arrowSide: TourStep['placement'] } {
  const pad = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0, left = 0, arrowSide = placement;

  if (placement === 'bottom') {
    top  = rect.bottom + pad + window.scrollY;
    left = rect.left + rect.width / 2 - popW / 2;
  } else if (placement === 'top') {
    top  = rect.top - popH - pad + window.scrollY;
    left = rect.left + rect.width / 2 - popW / 2;
  } else if (placement === 'right') {
    top  = rect.top + rect.height / 2 - popH / 2 + window.scrollY;
    left = rect.right + pad;
  } else {
    top  = rect.top + rect.height / 2 - popH / 2 + window.scrollY;
    left = rect.left - popW - pad;
  }

  // Clamp horizontal
  if (left < 12) { left = 12; }
  if (left + popW > vw - 12) { left = vw - popW - 12; }

  // Flip top/bottom if out of viewport
  if (placement === 'bottom' && rect.bottom + popH + pad > vh) {
    top = rect.top - popH - pad + window.scrollY;
    arrowSide = 'top';
  }
  if (placement === 'top' && rect.top - popH - pad < 0) {
    top = rect.bottom + pad + window.scrollY;
    arrowSide = 'bottom';
  }

  return { top, left, arrowSide };
}

interface Props {
  onDone: () => void;
}

export default function IronLedgerTour({ onDone }: Props) {
  const [step, setStep]             = useState(0);
  const [visible, setVisible]       = useState(false);
  const [pos, setPos]               = useState({ top: 0, left: 0 });
  const [arrowSide, setArrowSide]   = useState<TourStep['placement']>('bottom');
  const [highlight, setHighlight]   = useState<DOMRect | null>(null);
  const popoverRef                  = useRef<HTMLDivElement>(null);
  const POP_W = 320, POP_H = 200;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const position = () => {
    const rect = getTargetRect(current.target);
    if (!rect) return;
    setHighlight(rect);
    const { top, left, arrowSide } = getPopoverPosition(rect, current.placement, POP_W, POP_H);
    setPos({ top, left });
    setArrowSide(arrowSide);
    // Scroll element into view
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    // Small delay so page has rendered
    const t = setTimeout(() => { setVisible(true); position(); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(position, 80);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible]);

  const next = () => {
    if (isLast) { finish(); return; }
    setStep(s => s + 1);
  };
  const prev = () => setStep(s => Math.max(0, s - 1));
  const finish = () => {
    setVisible(false);
    setTimeout(onDone, 300);
  };

  if (!visible) return null;

  // Arrow styles
  const arrowSize = 8;
  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };
  let arrowPos: React.CSSProperties = {};
  if (arrowSide === 'bottom') {
    arrowPos = {
      top: -arrowSize,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
      borderColor: `transparent transparent rgba(184,255,0,0.25) transparent`,
    };
  } else if (arrowSide === 'top') {
    arrowPos = {
      bottom: -arrowSize,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
      borderColor: `rgba(184,255,0,0.25) transparent transparent transparent`,
    };
  } else if (arrowSide === 'right') {
    arrowPos = {
      top: '50%',
      left: -arrowSize,
      transform: 'translateY(-50%)',
      borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
      borderColor: `transparent rgba(184,255,0,0.25) transparent transparent`,
    };
  } else {
    arrowPos = {
      top: '50%',
      right: -arrowSize,
      transform: 'translateY(-50%)',
      borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
      borderColor: `transparent transparent transparent rgba(184,255,0,0.25)`,
    };
  }

  return (
    <>
      {/* Dark overlay with hole */}
      <svg
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9000, pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlight && (
              <rect
                x={highlight.left - 6}
                y={highlight.top - 6}
                width={highlight.width + 12}
                height={highlight.height + 12}
                rx="6"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8,9,9,0.82)" mask="url(#tour-mask)" />
        {/* Highlight border glow */}
        {highlight && (
          <rect
            x={highlight.left - 6}
            y={highlight.top - 6}
            width={highlight.width + 12}
            height={highlight.height + 12}
            rx="6"
            fill="none"
            stroke={current.accent ? C.accent : 'rgba(255,255,255,0.25)'}
            strokeWidth="1.5"
            opacity="0.9"
          />
        )}
      </svg>

      {/* Click-blocker (but allow clicking popover) */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9001, cursor: 'default' }}
        onClick={finish}
      />

      {/* Popover */}
      <div
        ref={popoverRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: pos.top,
          left: pos.left,
          width: POP_W,
          zIndex: 9002,
          background: '#0d0e0f',
          border: `1px solid ${current.accent ? 'rgba(184,255,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '8px',
          padding: '20px 22px 16px',
          boxShadow: current.accent
            ? '0 0 40px rgba(184,255,0,0.08), 0 20px 60px rgba(0,0,0,0.7)'
            : '0 20px 60px rgba(0,0,0,0.7)',
          fontFamily: C.mono,
          animation: 'tourFadeIn 0.22s ease',
        }}
      >
        {/* Arrow */}
        <div style={{ ...arrowStyle, ...arrowPos }} />

        {/* Step counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '18px' : '5px',
                  height: '5px',
                  borderRadius: '100px',
                  background: i === step ? C.accent : i < step ? 'rgba(184,255,0,0.35)' : 'rgba(255,255,255,0.12)',
                  transition: 'all 0.25s',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: '10px', color: C.dim, letterSpacing: '0.12em' }}>
            {step + 1} / {STEPS.length}
          </span>
        </div>

        {/* Title */}
        <div style={{
          fontSize: '14px',
          fontFamily: C.serif,
          color: current.accent ? C.accent : '#f0ede8',
          fontWeight: 700,
          marginBottom: '8px',
          letterSpacing: '-0.01em',
        }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{
          fontSize: '12px',
          color: C.mid,
          lineHeight: 1.75,
          marginBottom: '18px',
        }}>
          {current.body}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{
              background: 'none',
              border: 'none',
              color: C.dim,
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: C.mono,
              letterSpacing: '0.08em',
              padding: '4px 0',
            }}
          >
            Skip tour
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button
                onClick={prev}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: C.mid,
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: C.mono,
                  letterSpacing: '0.06em',
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={next}
              style={{
                padding: '8px 18px',
                background: isLast ? C.accent : 'rgba(184,255,0,0.12)',
                border: `1px solid ${isLast ? C.accent : 'rgba(184,255,0,0.3)'}`,
                borderRadius: '4px',
                color: isLast ? C.bg : C.accent,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: C.mono,
                letterSpacing: '0.08em',
              }}
            >
              {isLast ? 'Launch App →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}