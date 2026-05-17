'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import { OnboardingTour, TourButton } from '../components/OnboardingTour';
import GlobalCommand from '../components/GlobalCommand';
import TheForge from '../components/TheForge';
import WarRoom from '../components/WarRoom';
import TheVault from '../components/TheVault';
import {
  useNotifications,
  NotificationBell,
  NotificationPanel,
  NotificationToast,
  NotificationStyles,
} from '../components/NotificationSystem';

type TradeState = 'Created' | 'Funded' | 'InTransit' | 'Delivered' | 'Completed' | 'Cancelled';

interface Trade {
  id: string;
  buyer: string;
  seller: string;
  amount: string;
  deadline: number;
  createdAt: number;
  state: TradeState;
  slashingPenaltyBps: number;
  sellerSlashed: boolean;
}

const STATE_LABELS: TradeState[] = ['Created', 'Funded', 'InTransit', 'Delivered', 'Completed', 'Cancelled'];

function shortenAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function formatEth(wei: string) { return parseFloat(ethers.utils.formatEther(wei)).toFixed(4); }
function getExplorerUrl(hash: string, chainId: number) {
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${hash}`;
  return null;
}

// ── Mobile hook ───────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function useCountdown(deadlineTs: number) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = deadlineTs - now;
  if (diff <= 0) return { overdue: true, text: 'OVERDUE', h: 0, m: 0, s: 0, seconds: 0 };
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return { overdue: false, text: `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`, h, m, s, seconds: diff };
}

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

const S: Record<string, React.CSSProperties> = {
  root:       { minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, margin:0, padding:0 },
  grid:       { position:'fixed', inset:0, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none', zIndex:0 },
  page:       { position:'relative', zIndex:1, maxWidth:'800px', margin:'0 auto', padding:'0 16px 100px' },
  header:     { padding:'28px 0 20px', borderBottom:`1px solid ${C.border}`, marginBottom:'24px' },
  hrow:       { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap' as const, gap:'12px' },
  eyebrow:    { fontSize:'10px', letterSpacing:'0.22em', color:C.accent, textTransform:'uppercase' as const, marginBottom:'6px', fontWeight:600 },
  title:      { fontSize:'26px', fontFamily:C.serif, fontWeight:700, color:'#f2ede6', margin:'0 0 4px', letterSpacing:'-0.02em' },
  subtitle:   { fontSize:'11px', color:C.dim, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:0 },
  chip:       { display:'flex', alignItems:'center', gap:'9px', background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:'100px', padding:'8px 14px 8px 10px' },
  chipDot:    { width:'7px', height:'7px', borderRadius:'50%', background:C.accent, boxShadow:`0 0 8px ${C.accent}` },
  chipX:      { background:'none', border:'none', color:C.dim, fontSize:'11px', cursor:'pointer', paddingLeft:'6px' },
  stats:      { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden', marginBottom:'24px' },
  statCell:   { background:C.bg, padding:'16px 12px', textAlign:'center' as const },
  statNum:    { fontSize:'22px', fontWeight:700, fontFamily:C.serif, color:C.accent, lineHeight:1.1, marginBottom:'5px' },
  statLbl:    { fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const },
  panel:      { background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px 18px', marginBottom:'20px' },
  fg:         { marginBottom:'16px' },
  lbl:        { display:'block' as const, fontSize:'10px', fontWeight:600, letterSpacing:'0.15em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'8px' },
  input:      { width:'100%', padding:'13px 14px', background:'rgba(255,255,255,0.025)', border:`1px solid ${C.border}`, borderRadius:'4px', fontSize:'16px', color:C.text, fontFamily:C.mono, outline:'none', boxSizing:'border-box' as const, transition:'border-color 0.15s' },
  hint:       { fontSize:'11px', color:C.dim, marginTop:'5px' },
  grid2:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'16px' },
  btnPrimary: { width:'100%', padding:'16px', background:C.accent, color:C.bg, border:'none', borderRadius:'6px', fontSize:'14px', fontWeight:700, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' as const, fontFamily:C.mono, minHeight:'52px' },
  btnGhost:   { width:'100%', padding:'13px', background:'transparent', color:C.mid, border:`1px solid ${C.border}`, borderRadius:'6px', fontSize:'12px', cursor:'pointer', letterSpacing:'0.06em', textTransform:'uppercase' as const, fontFamily:C.mono, minHeight:'44px' },
  btnDanger:  { width:'100%', padding:'13px', background:'rgba(255,53,53,0.08)', color:C.danger, border:'1px solid rgba(255,53,53,0.25)', borderRadius:'6px', fontSize:'11px', fontWeight:700, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' as const, fontFamily:C.mono, minHeight:'44px' },
  btnSlash:   { width:'100%', padding:'16px', background:'linear-gradient(135deg,rgba(255,53,53,0.15),rgba(255,100,0,0.08))', color:C.danger, border:'1px solid rgba(255,53,53,0.5)', borderRadius:'6px', fontSize:'12px', fontWeight:700, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' as const, fontFamily:C.mono, minHeight:'52px' },
  receipt:    { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', background:'rgba(184,255,0,0.04)', border:'1px solid rgba(184,255,0,0.2)', borderRadius:'4px', padding:'12px 16px', fontSize:'12px', color:C.accent, marginBottom:'16px', flexWrap:'wrap' as const },
  alertErr:   { background:'rgba(255,53,53,0.06)', border:'1px solid rgba(255,53,53,0.2)', borderRadius:'4px', padding:'12px 14px', fontSize:'12px', color:'#ff7070', marginBottom:'16px' },
  secLbl:     { fontSize:'10px', fontWeight:600, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' },
  empty:      { textAlign:'center' as const, padding:'48px 20px', color:C.dim, fontSize:'13px' },
  cwrap:      { display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', minHeight:'60vh', textAlign:'center' as const, gap:'20px' },
  blur:       { filter:'blur(6px)', userSelect:'none' as const, pointerEvents:'none' as const },
  actions:    { display:'grid', gap:'8px', marginTop:'16px' },
  demoBox:    { padding:'10px 14px', background:'rgba(184,255,0,0.04)', border:'1px solid rgba(184,255,0,0.1)', borderRadius:'4px', fontSize:'11px', color:C.mid, marginBottom:'16px', lineHeight:1.7 },
  formToggle: { display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none' as const },
};

// ── WalletConnect modal ────────────────────────────────────────
function WalletSelectModal({ onClose, onMetaMask, onWalletConnect, connecting }: {
  onClose: () => void;
  onMetaMask: () => void;
  onWalletConnect: () => void;
  connecting: string | null;
}) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={onClose}>
      <div style={{ background:'#0f1011', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'28px 24px', width:'100%', maxWidth:'360px', fontFamily:C.mono }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:'10px', letterSpacing:'0.2em', color:C.accent, textTransform:'uppercase', marginBottom:'6px' }}>Connect Wallet</div>
        <div style={{ fontSize:'18px', fontFamily:C.serif, color:'#f2ede6', fontWeight:700, marginBottom:'6px' }}>Choose Connection</div>
        <div style={{ fontSize:'11px', color:C.dim, marginBottom:'24px', lineHeight:1.6 }}>
          Use MetaMask extension on desktop, or WalletConnect to connect from any mobile browser.
        </div>

        {/* MetaMask option */}
        <button
          onClick={onMetaMask}
          disabled={!!connecting}
          style={{ width:'100%', padding:'16px', background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', color:C.text, fontFamily:C.mono, cursor:'pointer', marginBottom:'10px', display:'flex', alignItems:'center', gap:'14px', textAlign:'left' as const, opacity: connecting === 'metamask' ? 0.6 : 1 }}
        >
          <span style={{ fontSize:'24px' }}>🦊</span>
          <div>
            <div style={{ fontSize:'13px', fontWeight:600, color:'#f2ede6', marginBottom:'2px' }}>
              {connecting === 'metamask' ? 'Connecting…' : 'MetaMask'}
            </div>
            <div style={{ fontSize:'10px', color:C.dim }}>Desktop browser extension</div>
          </div>
        </button>

        {/* WalletConnect option */}
        <button
          onClick={onWalletConnect}
          disabled={!!connecting}
          style={{ width:'100%', padding:'16px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:'8px', color:C.text, fontFamily:C.mono, cursor:'pointer', marginBottom:'20px', display:'flex', alignItems:'center', gap:'14px', textAlign:'left' as const, opacity: connecting === 'walletconnect' ? 0.6 : 1 }}
        >
          <span style={{ fontSize:'24px' }}>📱</span>
          <div>
            <div style={{ fontSize:'13px', fontWeight:600, color:'#38bdf8', marginBottom:'2px' }}>
              {connecting === 'walletconnect' ? 'Opening QR…' : 'WalletConnect'}
            </div>
            <div style={{ fontSize:'10px', color:C.dim }}>Mobile · Any browser · QR code</div>
          </div>
        </button>

        <button onClick={onClose} style={{ width:'100%', padding:'10px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'6px', color:C.dim, fontFamily:C.mono, fontSize:'11px', cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' as const }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPLASH GATE
// ═══════════════════════════════════════════════════════════════
function TerminalBoot({ onAuthenticate, onWalletConnect }: {
  onAuthenticate: () => void;
  onWalletConnect: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const isMobile = useIsMobile();
  const mono = "'DM Mono','Courier New',monospace";
  const accent = '#b8ff00';

  const handleMetaMask = async () => {
    setConnecting('metamask'); setErr('');
    try { await onAuthenticate(); }
    catch { setErr('MetaMask connection failed. Try again.'); }
    finally { setConnecting(null); setShowModal(false); }
  };

  const handleWalletConnect = async () => {
    setConnecting('walletconnect'); setErr('');
    try { await onWalletConnect(); }
    catch { setErr('WalletConnect failed. Try again.'); }
    finally { setConnecting(null); setShowModal(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#080909', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:mono, backgroundImage:'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize:'52px 52px', padding:'20px' }}>
      <div style={{position:'fixed',top:0,left:0,width:28,height:28,borderTop:`2px solid ${accent}22`,borderLeft:`2px solid ${accent}22`}}/>
      <div style={{position:'fixed',top:0,right:0,width:28,height:28,borderTop:`2px solid ${accent}22`,borderRight:`2px solid ${accent}22`}}/>
      <div style={{position:'fixed',bottom:0,left:0,width:28,height:28,borderBottom:`2px solid ${accent}22`,borderLeft:`2px solid ${accent}22`}}/>
      <div style={{position:'fixed',bottom:0,right:0,width:28,height:28,borderBottom:`2px solid ${accent}22`,borderRight:`2px solid ${accent}22`}}/>
      {!isMobile && (
        <div style={{position:'fixed',top:16,left:0,right:0,textAlign:'center',fontSize:10,letterSpacing:'0.2em',color:'rgba(255,255,255,0.15)'}}>
          IRON LEDGER // TERMINAL v4.1 — GLOBAL SETTLEMENT PROTOCOL
        </div>
      )}
      <div style={{width:'100%',maxWidth:400,padding: isMobile ? '36px 24px' : '48px 40px',background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,textAlign:'center'}}>
        <div style={{fontSize:36,marginBottom:20,opacity:0.9}}>⚖</div>
        <div style={{fontSize:10,letterSpacing:'0.22em',color:accent,textTransform:'uppercase',marginBottom:8}}>Iron Ledger Protocol v1</div>
        <div style={{fontSize: isMobile ? 22 : 26,fontFamily:"'DM Serif Display',Georgia,serif",color:'#f2ede6',fontWeight:700,marginBottom:6,letterSpacing:'-0.02em'}}>The Iron Ledger</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.18)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:28}}>Autonomous Escrow &amp; Settlement Protocol</div>
        <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:28,flexWrap:'wrap'}}>
          {[{label:'Arbitrum',color:'#00ff9d'},{label:'Chainlink',color:'#38bdf8'},{label:'ZK-Proof',color:'#a78bfa'}].map(({label,color})=>(
            <span key={label} style={{fontSize:9,padding:'3px 10px',border:`1px solid ${color}30`,borderRadius:100,color:color+'99',letterSpacing:'0.1em'}}>{label}</span>
          ))}
        </div>

        {/* Main connect button */}
        <button
          onClick={() => setShowModal(true)}
          style={{width:'100%',padding:'16px',background:accent,color:'#080909',border:'none',borderRadius:6,fontSize:14,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:mono,cursor:'pointer',transition:'all 0.2s',minHeight:'52px',marginBottom:'10px'}}
        >
          ▶  Connect Wallet / Enter
        </button>

        {/* Mobile hint */}
        {isMobile && (
          <button
            onClick={handleWalletConnect}
            style={{width:'100%',padding:'12px',background:'rgba(56,189,248,0.06)',color:'#38bdf8',border:'1px solid rgba(56,189,248,0.25)',borderRadius:6,fontSize:12,fontWeight:600,letterSpacing:'0.08em',fontFamily:mono,cursor:'pointer',marginBottom:'10px'}}
          >
            📱 Connect via WalletConnect
          </button>
        )}

        {err && <div style={{marginTop:14,fontSize:12,color:'#ff7070',background:'rgba(255,53,53,0.06)',border:'1px solid rgba(255,53,53,0.2)',borderRadius:4,padding:'10px 14px'}}>{err}</div>}
        <div style={{marginTop:16,fontSize:10,color:'rgba(255,255,255,0.12)',lineHeight:1.7}}>
          MetaMask (desktop) or WalletConnect (mobile).<br/>Connects to Sepolia or Hardhat Local.
        </div>
      </div>
      <div style={{position:'fixed',bottom:16,fontSize:9,letterSpacing:'0.1em',color:'rgba(255,255,255,0.08)',textAlign:'center',padding:'0 16px'}}>SESSION SECURE · TLS 1.3 · AES-256 · ZK-PROOF · v4.1.0-mainnet</div>

      {showModal && (
        <WalletSelectModal
          onClose={() => setShowModal(false)}
          onMetaMask={handleMetaMask}
          onWalletConnect={handleWalletConnect}
          connecting={connecting}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════
function CountdownRing({ deadlineTs, totalSeconds }: { deadlineTs: number; totalSeconds: number }) {
  const { overdue, h, m, s, seconds } = useCountdown(deadlineTs);
  const R = 26, circ = 2 * Math.PI * R;
  const pct   = overdue ? 0 : Math.min(seconds / Math.max(totalSeconds, 1), 1);
  const color = overdue ? C.danger : seconds < 30 ? '#ffaa00' : C.accent;
  return (
    <div data-tour="countdown" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', minWidth:'72px' }}>
      <svg width="60" height="60" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="30" cy="30" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="30" cy="30" r={R} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.95s linear, stroke 0.3s' }} />
      </svg>
      {overdue ? (
        <div style={{ fontSize:'11px', fontWeight:700, color:C.danger, letterSpacing:'0.08em', fontFamily:C.mono, animation:'overdueFlash 1.2s ease-in-out infinite' }}>OVERDUE</div>
      ) : (
        <div style={{ fontFamily:C.mono, textAlign:'center', lineHeight:1.3 }}>
          {h > 0 && <div style={{ fontSize:'11px', color, fontWeight:600 }}>{h}h {String(m).padStart(2,'0')}m</div>}
          <div style={{ fontSize: h > 0 ? '11px' : '18px', color, fontWeight:700 }}>{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</div>
        </div>
      )}
      <div style={{ fontSize:'8px', letterSpacing:'0.12em', color:C.dim, textTransform:'uppercase' }}>
        {overdue ? 'claimable' : 'remaining'}
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{ width:'34px', height:'19px', borderRadius:'100px', background: on ? 'rgba(184,255,0,0.25)' : 'rgba(255,255,255,0.07)', border: on ? '1px solid rgba(184,255,0,0.4)' : `1px solid ${C.border}`, position:'relative', cursor:'pointer', transition:'all 0.2s', flexShrink:0, minWidth:'34px' }}>
      <div style={{ position:'absolute', top:'2px', left: on ? '15px' : '2px', width:'13px', height:'13px', borderRadius:'50%', background: on ? C.accent : C.dim, transition:'left 0.2s, background 0.2s' }} />
    </div>
  );
}

function Badge({ state }: { state: TradeState }) {
  const map: Record<TradeState,[string,string]> = {
    Created:   ['rgba(120,120,255,0.1)','#9999ff'],
    Funded:    ['rgba(184,255,0,0.07)', C.accent],
    InTransit: ['rgba(255,165,0,0.1)', '#ffaa00'],
    Delivered: ['rgba(0,200,100,0.1)', '#00cc77'],
    Completed: ['rgba(255,255,255,0.04)','rgba(255,255,255,0.3)'],
    Cancelled: ['rgba(255,53,53,0.07)', '#ff6666'],
  };
  const [bg, color] = map[state];
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', background:bg, color, border:`1px solid ${color}33`, borderRadius:'100px', fontSize:'10px', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:C.mono }}>{state}</span>;
}

function TradeCard({ trade, account, privacy, txLoading, chainId, onExec, isMobile }: {
  trade: Trade; account: string; privacy: boolean;
  txLoading: string | null; chainId: number;
  onExec: (id: string, method: string, opts?: any) => void;
  isMobile: boolean;
}) {
  const { overdue } = useCountdown(trade.deadline);
  const isBuyer    = account.toLowerCase() === trade.buyer.toLowerCase();
  const isSeller   = account.toLowerCase() === trade.seller.toLowerCase();
  const stateIdx   = STATE_LABELS.indexOf(trade.state);
  const isTerminal = trade.state === 'Completed' || trade.state === 'Cancelled';
  const canSlash   = overdue && (trade.state === 'Funded' || trade.state === 'InTransit') && isBuyer && !trade.sellerSlashed;
  const isActing   = txLoading === trade.id;
  const totalSecs  = Math.max(trade.deadline - trade.createdAt, 1);

  return (
    <div style={{ background: overdue && !isTerminal ? 'rgba(255,53,53,0.03)' : C.surface, border:`1px solid ${overdue && !isTerminal ? 'rgba(255,53,53,0.22)' : C.border}`, borderRadius:'8px', padding: isMobile ? '16px' : '20px 22px', marginBottom:'12px', transition:'border-color 0.4s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
        <span style={{ fontSize:'11px', color:C.dim, fontFamily:C.mono }}>{isMobile ? `${trade.id.slice(0,8)}…` : `ID ${trade.id.slice(0,10)}…${trade.id.slice(-6)}`}</span>
        <Badge state={trade.state} />
      </div>

      {!isMobile && trade.state !== 'Cancelled' && (
        <div style={{ display:'flex', alignItems:'center', marginBottom:'18px', overflowX:'auto' }}>
          {(['Created','Funded','InTransit','Delivered','Completed'] as TradeState[]).map((s, i, arr) => {
            const past = stateIdx > i, act = stateIdx === i;
            const col  = past || act ? C.accent : 'rgba(255,255,255,0.1)';
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', flex: i < arr.length-1 ? '1 1 auto' : '0 0 auto' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:col, boxShadow: act ? `0 0 8px ${C.accent}` : 'none', animation: act && !isTerminal ? 'activePulse 2s ease-in-out infinite' : 'none', transition:'all 0.3s' }} />
                  <span style={{ fontSize:'8px', letterSpacing:'0.08em', color: act ? C.accent : past ? C.mid : C.dim, textTransform:'uppercase', whiteSpace:'nowrap', fontFamily:C.mono }}>{s}</span>
                </div>
                {i < arr.length-1 && <div style={{ flex:'1 1 auto', height:'1px', background: past ? C.accent : C.border, minWidth:'14px', marginBottom:'12px', transition:'background 0.3s' }} />}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap:'16px', alignItems:'center', marginBottom:'14px' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(110px,1fr))', gap:'12px' }}>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase', marginBottom:'3px' }}>Amount</div>
            <div style={privacy ? S.blur : { fontSize:'16px', color:C.accent, fontWeight:600, fontFamily:C.mono }}>{formatEth(trade.amount)} ETH</div>
          </div>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase', marginBottom:'3px' }}>Role</div>
            <div style={{ fontSize:'13px', color:C.text, fontFamily:C.mono }}>{isBuyer ? '⬆ Buyer' : '⬇ Seller'}</div>
          </div>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase', marginBottom:'3px' }}>Counterparty</div>
            <div style={privacy ? { fontSize:'13px', color:C.text, fontFamily:C.mono, ...S.blur } : { fontSize:'13px', color:C.text, fontFamily:C.mono }}>
              {shortenAddr(isBuyer ? trade.seller : trade.buyer)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase', marginBottom:'3px' }}>Penalty</div>
            <div style={{ fontSize:'13px', color:C.text, fontFamily:C.mono }}>{trade.slashingPenaltyBps/100}%</div>
          </div>
        </div>
        {!isTerminal && (
          <div style={{ display:'flex', justifyContent: isMobile ? 'center' : 'flex-end' }}>
            <CountdownRing deadlineTs={trade.deadline} totalSeconds={totalSecs} />
          </div>
        )}
      </div>

      {!isTerminal && (
        <div style={S.actions}>
          {canSlash && (
            <button style={{ ...S.btnSlash, animation:'slashPulse 1.6s ease-in-out infinite' }}
              onClick={() => onExec(trade.id,'slashSellerAndComplete')} disabled={isActing}>
              {isActing ? '⏳ Processing…' : `⚡ INITIATE SLASHING PROTOCOL — SEIZE ${trade.slashingPenaltyBps/100}%`}
            </button>
          )}
          {isBuyer && trade.state === 'Created' && (
            <button style={S.btnGhost} onClick={() => onExec(trade.id,'fundTrade',{value:trade.amount})} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Fund Escrow ]'}
            </button>
          )}
          {isBuyer && trade.state === 'Delivered' && (
            <button style={{ ...S.btnGhost, color:C.accent, borderColor:'rgba(184,255,0,0.3)' }} onClick={() => onExec(trade.id,'completeTrade')} disabled={isActing}>
              {isActing ? 'Processing…' : '✓ Release Payment to Seller'}
            </button>
          )}
          {isBuyer && (trade.state === 'Created' || trade.state === 'Funded') && (
            <button style={S.btnDanger} onClick={() => onExec(trade.id,'cancelTrade')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Cancel Trade ]'}
            </button>
          )}
          {isSeller && trade.state === 'Funded' && (
            <button style={S.btnGhost} onClick={() => onExec(trade.id,'updateStatusInTransit')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Mark In Transit ]'}
            </button>
          )}
          {isSeller && trade.state === 'InTransit' && (
            <button style={S.btnGhost} onClick={() => onExec(trade.id,'updateStatusDelivered')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Confirm Delivery ]'}
            </button>
          )}
          {isSeller && trade.state === 'Created' && (
            <button style={S.btnDanger} onClick={() => onExec(trade.id,'cancelTrade')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Cancel Trade ]'}
            </button>
          )}
        </div>
      )}
      {trade.sellerSlashed && (
        <div style={{ marginTop:'10px', fontSize:'10px', color:C.danger, letterSpacing:'0.1em', textTransform:'uppercase' }}>
          ⚡ Slashing executed — {trade.slashingPenaltyBps/100}% seized from seller
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const isMobile = useIsMobile();
  const [booted,        setBooted]       = useState(false);
  const [screen,        setScreen]       = useState<'command'|'ledger'|'forge'|'warroom'|'vault'>('command');
  const [showTour,      setShowTour]     = useState(false);
  const [account,       setAccount]      = useState<string|null>(null);
  const [chainId,       setChainId]      = useState<number>(31337);
  const [trades,        setTrades]       = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades]= useState(false);
  const [error,         setError]        = useState<string|null>(null);
  const [lastTxHash,    setLastTxHash]   = useState<string|null>(null);
  const [lastTxLabel,   setLastTxLabel]  = useState<string>('');
  const [loading,       setLoading]      = useState(false);
  const [privacy,       setPrivacy]      = useState(false);
  const [txLoading,     setTxLoading]    = useState<string|null>(null);
  const [demoMode,      setDemoMode]     = useState(true);
  const [formOpen,      setFormOpen]     = useState(false);
  const [seller,   setSeller]   = useState('');
  const [amount,   setAmount]   = useState('');
  const [deadline, setDeadline] = useState('60');
  const [penalty,  setPenalty]  = useState('100');
  const [connType,      setConnType]     = useState<'metamask'|'walletconnect'|null>(null);

  // ── Notifications ─────────────────────────────────────────────
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [latestToast,    setLatestToast]    = useState<any>(null);
  const {
    permission,
    requestPermission,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications(trades, account || '');

  useEffect(() => {
    if (notifications.length > 0 && !notifications[0].read) {
      setLatestToast(notifications[0]);
    }
  }, [notifications]);

  const loadTradesForAddr = useCallback(async (addr: string, provider: any) => {
    try {
      setLoadingTrades(true);
      const ethProvider = new ethers.providers.Web3Provider(provider);
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethProvider);
      const count = await c.getTradeCount();
      const total = Number(count);
      const loaded: Trade[] = [];
      for (let i = 0; i < total; i++) {
        try {
          const id = await c.getTradeIdAtIndex(i);
          const t  = await c.getTrade(id);
          const state = STATE_LABELS[t.state] as TradeState;
          if (t.buyer.toLowerCase() === addr.toLowerCase() || t.seller.toLowerCase() === addr.toLowerCase()) {
            loaded.push({ id, buyer:t.buyer, seller:t.seller, amount:t.amount.toString(), deadline:t.deadline.toNumber(), createdAt:t.createdAt.toNumber(), state, slashingPenaltyBps:t.slashingPenaltyBps, sellerSlashed:t.sellerSlashed });
          }
        } catch { /* skip */ }
      }
      setTrades(loaded.reverse());
    } catch { /* ignore */ }
    finally { setLoadingTrades(false); }
  }, []);

  // ── MetaMask connect ──────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    try {
      const w = window as any;
      if (!w.ethereum) { setError('MetaMask not found. Please install MetaMask and reload.'); setBooted(true); return; }
      try {
        await w.ethereum.request({ method:'wallet_switchEthereumChain', params:[{ chainId:'0xaa36a7' }] });
      } catch (se: any) {
        if (se.code === 4902) {
          await w.ethereum.request({ method:'wallet_addEthereumChain', params:[{ chainId:'0xaa36a7', chainName:'Sepolia Testnet', rpcUrls:['https://rpc.sepolia.org'], nativeCurrency:{ name:'ETH', symbol:'ETH', decimals:18 }, blockExplorerUrls:['https://sepolia.etherscan.io'] }]});
        } else {
          try { await w.ethereum.request({ method:'wallet_switchEthereumChain', params:[{ chainId:'0x7a69' }] }); } catch { /* ignore */ }
        }
      }
      const accs = await w.ethereum.request({ method:'eth_requestAccounts' });
      const addr = accs[0];
      const provider = new ethers.providers.Web3Provider(w.ethereum);
      const network  = await provider.getNetwork();
      setChainId(network.chainId);
      setAccount(addr);
      setConnType('metamask');
      setError(null);
      await loadTradesForAddr(addr, w.ethereum);
      if (!localStorage.getItem('il-tour-v1')) setTimeout(() => setShowTour(true), 1200);
    } catch (e: any) {
      const m = String(e?.message || '');
      if (!m.includes('ENS') && !m.includes('getResolver')) setError('Failed: ' + m.slice(0, 100));
    } finally {
      setBooted(true);
    }
  }, [loadTradesForAddr]);

  // ── WalletConnect connect ─────────────────────────────────────
  const connectWalletConnect = useCallback(async () => {
    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

      const wcProvider = await EthereumProvider.init({
        projectId: '8e7877fa5bc74c9a2d51e58450a544d7',
        chains: [11155111],
        optionalChains: [31337],
        showQrModal: true,
      });

      await wcProvider.connect();

      // Try accounts from provider, fallback to eth_accounts request
      let accounts: string[] = wcProvider.accounts || [];
      if (!accounts.length) {
        accounts = await wcProvider.request({ method: 'eth_accounts' }) as string[];
      }
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned');

      const addr = accounts[0];
      const ethProvider = new ethers.providers.Web3Provider(wcProvider as any);
      const network = await ethProvider.getNetwork();

      setChainId(network.chainId);
      setAccount(addr);
      setConnType('walletconnect');
      setError(null);
      (window as any).__wcProvider = wcProvider;
      await loadTradesForAddr(addr, wcProvider);
      if (!localStorage.getItem('il-tour-v1')) setTimeout(() => setShowTour(true), 1200);

    } catch (e: any) {
      const m = String(e?.message || '');
      if (!m.includes('closed') && !m.includes('rejected') && !m.includes('User rejected')) {
        setError('WalletConnect failed: ' + m.slice(0, 100));
      }
    } finally {
      setBooted(true);
    }
  }, [loadTradesForAddr]);

  useEffect(() => {
    const l = document.createElement('link');
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Serif+Display&display=swap';
    l.rel = 'stylesheet'; document.head.appendChild(l);
    const s = document.createElement('style');
    s.textContent = `
      *{box-sizing:border-box}
      input:focus{border-color:rgba(184,255,0,0.35)!important}
      input::placeholder{color:rgba(255,255,255,0.12)}
      input[type=number]::-webkit-inner-spin-button{opacity:0.3;filter:invert(1)}
      button:active{opacity:0.75}
      @keyframes slashPulse{0%,100%{box-shadow:0 0 18px rgba(255,53,53,0.1),inset 0 0 18px rgba(255,53,53,0.03)}50%{box-shadow:0 0 40px rgba(255,53,53,0.4),inset 0 0 30px rgba(255,53,53,0.08)}}
      @keyframes overdueFlash{0%,100%{opacity:1}50%{opacity:0.4}}
      @keyframes activePulse{0%,100%{box-shadow:0 0 4px #b8ff00;transform:scale(1)}50%{box-shadow:0 0 12px #b8ff00,0 0 20px rgba(184,255,0,0.3);transform:scale(1.35)}}
      @keyframes mapPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.9;transform:scale(1.5)}}
      @keyframes feedSlide{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      ::-webkit-scrollbar{width:3px;height:3px}
      ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      .gc-tab{cursor:pointer}
      .gc-node-row:hover{background:rgba(255,255,255,0.02)!important}
      @media(max-width:768px){
        .mobile-nav-scroll{display:flex;overflow-x:auto;gap:8px;padding-bottom:4px;scrollbar-width:none}
        .mobile-nav-scroll::-webkit-scrollbar{display:none}
      }
    `;
    document.head.appendChild(s);
  }, []);

  const getProvider = () => {
    if (connType === 'walletconnect' && (window as any).__wcProvider) {
      return new ethers.providers.Web3Provider((window as any).__wcProvider);
    }
    return new ethers.providers.Web3Provider((window as any).ethereum);
  };

  if (!booted) return (
    <TerminalBoot
      onAuthenticate={connectWallet}
      onWalletConnect={connectWalletConnect}
    />
  );

  if (screen === 'command') {
    return (
      <GlobalCommand
        account={account || ''}
        trades={trades}
        onEnterLedger={() => setScreen('ledger')}
      />
    );
  }

  if (screen === 'warroom') {
    return (
      <WarRoom
        account={account || ''}
        trades={trades}
        onBack={() => setScreen('ledger')}
        onTradeUpdate={() => { if (account) loadTradesForAddr(account, connType === 'walletconnect' ? (window as any).__wcProvider : (window as any).ethereum); }}
      />
    );
  }

  if (screen === 'vault') {
    return (
      <TheVault
        account={account || ''}
        trades={trades}
        onBack={() => setScreen('ledger')}
      />
    );
  }

  if (screen === 'forge') {
    return (
      <TheForge
        account={account || ''}
        trades={trades}
        onBack={() => setScreen('ledger')}
        onCreated={() => { if (account) loadTradesForAddr(account, connType === 'walletconnect' ? (window as any).__wcProvider : (window as any).ethereum); }}
      />
    );
  }

  // ── Ledger screen ─────────────────────────────────────────────
  const getContract = (signer = false) => {
    const p = getProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer ? p.getSigner() : p);
  };

  const createTrade = async () => {
    if (!seller || !amount || !deadline || !penalty) { setError('All fields required.'); return; }
    try {
      setLoading(true); setError(null); setLastTxHash(null);
      const c = getContract(true);
      const secs = demoMode ? parseInt(deadline) : parseInt(deadline) * 86400;
      const deadlineTs = Math.floor(Date.now() / 1000) + secs;
      const wei = ethers.utils.parseEther(amount);
      const tx = await c.createTrade(seller, wei, deadlineTs, parseInt(penalty));
      await tx.wait();
      setLastTxHash(tx.hash); setLastTxLabel('Trade Created on Ethereum');
      setSeller(''); setAmount(''); setDeadline(demoMode ? '60' : '7'); setPenalty('100');
      setFormOpen(false);
      await loadTradesForAddr(account!, connType === 'walletconnect' ? (window as any).__wcProvider : (window as any).ethereum);
    } catch (e: any) { setError(String(e?.message || e?.reason || 'Failed').slice(0,150)); }
    finally { setLoading(false); }
  };

  const exec = async (id: string, method: string, opts: any = {}) => {
    try {
      setTxLoading(id); setError(null); setLastTxHash(null);
      const c = getContract(true);
      const tx = method === 'fundTrade'
        ? await c.fundTrade(id, { value: ethers.BigNumber.from(opts.value || '0') })
        : await c[method](id);
      await tx.wait();
      const labels: Record<string,string> = { fundTrade:'Escrow Funded', updateStatusInTransit:'Status: In Transit', updateStatusDelivered:'Status: Delivered', completeTrade:'Payment Released', cancelTrade:'Trade Cancelled', slashSellerAndComplete:'⚡ Slashing Executed' };
      setLastTxHash(tx.hash); setLastTxLabel(labels[method] || method);
      await loadTradesForAddr(account!, connType === 'walletconnect' ? (window as any).__wcProvider : (window as any).ethereum);
    } catch (e: any) { setError(String(e?.message || e?.reason || 'Failed').slice(0,150)); }
    finally { setTxLoading(null); }
  };

  const nowSec      = Math.floor(Date.now() / 1000);
  const active      = trades.filter(t => !['Completed','Cancelled'].includes(t.state)).length;
  const lockedWei   = trades.filter(t => ['Funded','InTransit','Delivered'].includes(t.state)).reduce((a, t) => a + BigInt(t.amount), BigInt(0));
  const lockedEth   = parseFloat(ethers.utils.formatEther(lockedWei.toString())).toFixed(3);
  const overdueCnt  = trades.filter(t => t.deadline < nowSec && ['Funded','InTransit'].includes(t.state)).length;
  const explorerUrl = lastTxHash ? getExplorerUrl(lastTxHash, chainId) : null;

  const disconnect = () => {
    if (connType === 'walletconnect' && (window as any).__wcProvider) {
      (window as any).__wcProvider.disconnect();
      (window as any).__wcProvider = null;
    }
    setAccount(null); setTrades([]); setLastTxHash(null); setConnType(null);
  };

  return (
    <>
      <NotificationStyles />
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
      <NotificationToast notification={latestToast} onDismiss={() => setLatestToast(null)} />
      <TourButton onClick={() => setShowTour(true)} />
      <div style={S.grid} />
      <main style={S.root}>
        <div style={{ ...S.page, padding: isMobile ? '0 12px 80px' : '0 24px 100px' }}>
          <header style={S.header}>
            <div style={S.hrow}>
              <div>
                <div style={S.eyebrow}>Iron Ledger Protocol v1</div>
                <h1 style={{ ...S.title, fontSize: isMobile ? '22px' : '26px' }}>The Iron Ledger</h1>
                {!isMobile && <p style={S.subtitle}>Autonomous Escrow &amp; Settlement Protocol — On-Chain</p>}
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                {account && (
                  <div style={{ position:'relative' }}>
                    <NotificationBell
                      unreadCount={unreadCount}
                      onClick={() => setNotifPanelOpen(o => !o)}
                      permission={permission}
                      onRequestPermission={requestPermission}
                    />
                    {notifPanelOpen && (
                      <NotificationPanel
                        notifications={notifications}
                        onMarkRead={markRead}
                        onMarkAllRead={markAllRead}
                        onClear={clearAll}
                        onClose={() => setNotifPanelOpen(false)}
                        permission={permission}
                        onRequestPermission={requestPermission}
                      />
                    )}
                  </div>
                )}
                {account && (
                  <div data-tour="wallet" style={{ ...S.chip, padding:'6px 12px 6px 8px' }}>
                    <div style={S.chipDot} />
                    <span style={{ fontSize:'11px', color:C.mid }}>{shortenAddr(account)}</span>
                    {!isMobile && connType === 'walletconnect' && <span style={{ fontSize:'9px', color:'#38bdf8', marginLeft:'4px' }}>· WC</span>}
                    {!isMobile && chainId === 11155111 && <span style={{ fontSize:'9px', color:C.dim, marginLeft:'4px' }}>· Sepolia</span>}
                    {!isMobile && chainId === 31337    && <span style={{ fontSize:'9px', color:C.dim, marginLeft:'4px' }}>· Local</span>}
                    <button style={S.chipX} onClick={disconnect}>✕</button>
                  </div>
                )}
              </div>
            </div>

            <div className="mobile-nav-scroll" style={{ marginTop:'14px', display:'flex', gap:'8px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
              <button onClick={() => setScreen('command')} style={{ ...S.btnGhost, width:'auto', padding:'8px 14px', fontSize:10, flexShrink:0 }}>
                ← Overview
              </button>
              <button
                onClick={() => setScreen('warroom')}
                style={{
                  ...S.btnGhost, width:'auto', padding:'8px 14px', fontSize:10, flexShrink:0,
                  color: overdueCnt > 0 ? C.danger : C.mid,
                  borderColor: overdueCnt > 0 ? 'rgba(255,53,53,0.4)' : C.border,
                  background: overdueCnt > 0 ? 'rgba(255,53,53,0.06)' : 'transparent',
                  animation: overdueCnt > 0 ? 'slashPulse 1.6s ease-in-out infinite' : 'none',
                }}
              >
                ⚠ Risk Monitor{overdueCnt > 0 ? ` (${overdueCnt}!)` : ''}
              </button>
              <button onClick={() => setScreen('forge')} style={{ ...S.btnGhost, width:'auto', padding:'8px 14px', fontSize:10, color:C.accent, borderColor:'rgba(184,255,0,0.3)', flexShrink:0 }}>
                ✦ Contract Drafting
              </button>
              <button
                onClick={() => setScreen('vault')}
                style={{ ...S.btnGhost, width:'auto', padding:'8px 14px', fontSize:10, color:'#a78bfa', borderColor:'rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.04)', flexShrink:0 }}
              >
                ◈ Performance Analytics
              </button>
            </div>
          </header>

          {!account && (
            <div style={S.cwrap}>
              <div style={{ fontSize:'48px' }}>⚖</div>
              <div>
                <p style={{ ...S.title, margin:'0 0 8px', fontSize: isMobile ? '20px' : '26px' }}>Connect to The Iron Ledger</p>
                <p style={{ fontSize:'13px', color:C.dim, margin:0, maxWidth:'340px', lineHeight:1.7 }}>
                  Trustless commodity escrow with live countdown enforcement.
                </p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', width:'100%', maxWidth:'320px' }}>
                <button data-tour="wallet" style={{ ...S.btnPrimary }} onClick={connectWallet}>
                  🦊 Connect MetaMask
                </button>
                <button style={{ ...S.btnGhost, color:'#38bdf8', borderColor:'rgba(56,189,248,0.3)', background:'rgba(56,189,248,0.04)' }} onClick={connectWalletConnect}>
                  📱 Connect via WalletConnect
                </button>
              </div>
              {error && <div style={{ ...S.alertErr, maxWidth:'400px' }}>{error}</div>}
            </div>
          )}

          {account && (
            <>
              <div data-tour="stats" style={S.stats}>
                <div style={S.statCell}>
                  <div style={S.statNum}>{active}</div>
                  <div style={S.statLbl}>Active</div>
                </div>
                <div style={S.statCell}>
                  <div style={{ ...S.statNum, ...(privacy ? S.blur : {}) }}>{lockedEth} ETH</div>
                  <div style={S.statLbl}>Escrow</div>
                </div>
                <div style={S.statCell}>
                  <div style={{ ...S.statNum, color: overdueCnt > 0 ? C.danger : C.accent }}>{overdueCnt}</div>
                  <div style={S.statLbl}>Overdue</div>
                </div>
              </div>

              {error && <div style={S.alertErr}>{error}</div>}
              {lastTxHash && (
                <div style={S.receipt}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'14px' }}>✓</span>
                    <span style={{ fontWeight:600 }}>{lastTxLabel}</span>
                  </div>
                  {explorerUrl
                    ? <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize:'11px', color:C.accent, textDecoration:'none', border:`1px solid rgba(184,255,0,0.3)`, borderRadius:'4px', padding:'4px 10px', letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>View →</a>
                    : <span style={{ fontSize:'10px', color:C.dim, fontFamily:C.mono }}>{lastTxHash.slice(0,14)}…</span>
                  }
                </div>
              )}

              <div data-tour="create-form" style={S.panel}>
                <div data-tour="demo-toggle" style={S.formToggle} onClick={() => setFormOpen(o => !o)}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                    <p style={{ fontSize:'14px', fontWeight:600, color:'#f0ede8', margin:0 }}>
                      {formOpen ? '▾ New Trade' : '▸ New Trade'}
                    </p>
                    <span style={{ fontSize:'10px', letterSpacing:'0.1em', color: demoMode ? C.accent : C.dim, textTransform:'uppercase', background:'rgba(184,255,0,0.06)', border:'1px solid rgba(184,255,0,0.15)', borderRadius:'100px', padding:'2px 10px' }}>
                      {demoMode ? '⚡ Demo' : '🏭 Prod'}
                    </span>
                    {!isMobile && (
                      <span
                        onClick={e => { e.stopPropagation(); setScreen('forge'); }}
                        style={{ fontSize:'10px', color:C.accent, cursor:'pointer', textDecoration:'underline', letterSpacing:'0.08em' }}
                      >
                        ✦ Open in Contract Drafting →
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize:'10px', color:C.dim, textTransform:'uppercase', letterSpacing:'0.08em' }}>{demoMode ? 'Sec' : 'Days'}</span>
                    <Toggle on={demoMode} onChange={() => { setDemoMode(d => !d); setDeadline(demoMode ? '7' : '60'); }} />
                  </div>
                </div>
                {formOpen && (
                  <div style={{ marginTop:'20px' }}>
                    <div style={S.fg}>
                      <label style={S.lbl}>Seller Address</label>
                      <input style={S.input} type="text" placeholder="0x…" value={seller} onChange={e => setSeller(e.target.value)} autoCapitalize="none" autoCorrect="off" />
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>Escrow Amount (ETH)</label>
                      <input style={S.input} type="number" placeholder="0.1" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
                    </div>
                    <div style={isMobile ? {} : S.grid2}>
                      <div style={{ marginBottom:'16px' }}>
                        <label style={S.lbl}>Deadline ({demoMode ? 'seconds' : 'days'})</label>
                        <input style={S.input} type="number" placeholder={demoMode ? '60' : '7'} value={deadline} onChange={e => setDeadline(e.target.value)} inputMode="numeric" />
                      </div>
                      <div style={{ marginBottom:'16px' }}>
                        <label style={S.lbl}>Penalty (bps)</label>
                        <input style={S.input} type="number" placeholder="100" value={penalty} onChange={e => setPenalty(e.target.value)} inputMode="numeric" />
                        <p style={S.hint}>100 bps = 1% | max 255</p>
                      </div>
                    </div>
                    {demoMode && (
                      <div style={S.demoBox}>
                        💡 <strong style={{ color:C.accent }}>Demo:</strong> Set deadline to <strong style={{ color:C.accent }}>30</strong>s → Create → Fund → watch ring drain → <strong style={{ color:C.danger }}>⚡ Slash activates automatically</strong>.
                      </div>
                    )}
                    <button style={{ ...S.btnPrimary, opacity:loading ? 0.6 : 1, cursor:loading ? 'not-allowed' : 'pointer' }} onClick={createTrade} disabled={loading}>
                      {loading ? 'Submitting…' : 'Create Trade'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
                  <div data-tour="ledger" style={S.secLbl}>Active Ledger</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    {!isMobile && (
                      <span
                        onClick={() => setScreen('vault')}
                        style={{ fontSize:'10px', color:'#a78bfa', cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' as const, textDecoration:'underline' }}
                      >
                        ◈ My Analytics →
                      </span>
                    )}
                    <div data-tour="privacy" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'10px', letterSpacing:'0.12em', color:C.dim, textTransform:'uppercase' as const }}>Privacy</span>
                      <Toggle on={privacy} onChange={() => setPrivacy(p => !p)} />
                    </div>
                  </div>
                </div>
                {loadingTrades && <div style={S.empty}>Loading trades from chain…</div>}
                {!loadingTrades && trades.length === 0 && (
                  <div style={S.empty}>
                    No trades found.<br />
                    <span style={{ cursor:'pointer', color:C.accent, textDecoration:'underline' }} onClick={() => setScreen('forge')}>
                      Open Contract Drafting to create your first trade ↑
                    </span>
                  </div>
                )}
                {!loadingTrades && trades.map(t => (
                  <TradeCard key={t.id} trade={t} account={account} privacy={privacy} txLoading={txLoading} chainId={chainId} onExec={exec} isMobile={isMobile} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}