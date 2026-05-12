'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';
import IronLedgerTour from '../components/IronLedgerTour';

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

// ── Live countdown hook — ticks every second ──────────────────
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

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:       '#080909',
  surface:  '#0f1011',
  border:   'rgba(255,255,255,0.06)',
  accent:   '#b8ff00',
  danger:   '#ff3535',
  text:     '#ddd9d0',
  mid:      'rgba(255,255,255,0.4)',
  dim:      'rgba(255,255,255,0.18)',
  mono:     "'DM Mono','Courier New',monospace",
  serif:    "'DM Serif Display',Georgia,serif",
};

const S: Record<string, React.CSSProperties> = {
  root:      { minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, margin:0, padding:0 },
  grid:      { position:'fixed', inset:0, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none', zIndex:0 },
  page:      { position:'relative', zIndex:1, maxWidth:'800px', margin:'0 auto', padding:'0 24px 100px' },
  header:    { padding:'40px 0 28px', borderBottom:`1px solid ${C.border}`, marginBottom:'32px' },
  hrow:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap' as const, gap:'12px' },
  eyebrow:   { fontSize:'10px', letterSpacing:'0.22em', color:C.accent, textTransform:'uppercase' as const, marginBottom:'6px', fontWeight:600 },
  title:     { fontSize:'30px', fontFamily:C.serif, fontWeight:700, color:'#f2ede6', margin:'0 0 4px', letterSpacing:'-0.02em' },
  subtitle:  { fontSize:'11px', color:C.dim, letterSpacing:'0.1em', textTransform:'uppercase' as const, margin:0 },
  chip:      { display:'flex', alignItems:'center', gap:'9px', background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:'100px', padding:'8px 14px 8px 10px' },
  chipDot:   { width:'7px', height:'7px', borderRadius:'50%', background:C.accent, boxShadow:`0 0 8px ${C.accent}` },
  chipX:     { background:'none', border:'none', color:C.dim, fontSize:'11px', cursor:'pointer', paddingLeft:'6px' },
  stats:     { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden', marginBottom:'28px' },
  statCell:  { background:C.bg, padding:'18px 20px', textAlign:'center' as const },
  statNum:   { fontSize:'24px', fontWeight:700, fontFamily:C.serif, color:C.accent, lineHeight:1.1, marginBottom:'5px' },
  statLbl:   { fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const },
  panel:     { background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'26px', marginBottom:'24px' },
  fg:        { marginBottom:'16px' },
  lbl:       { display:'block' as const, fontSize:'10px', fontWeight:600, letterSpacing:'0.15em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'8px' },
  input:     { width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.025)', border:`1px solid ${C.border}`, borderRadius:'4px', fontSize:'13px', color:C.text, fontFamily:C.mono, outline:'none', boxSizing:'border-box' as const, transition:'border-color 0.15s' },
  hint:      { fontSize:'11px', color:C.dim, marginTop:'5px' },
  grid2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'16px' },
  btnPrimary:{ width:'100%', padding:'15px', background:C.accent, color:C.bg, border:'none', borderRadius:'4px', fontSize:'13px', fontWeight:700, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' as const, fontFamily:C.mono },
  btnGhost:  { width:'100%', padding:'12px', background:'transparent', color:C.mid, border:`1px solid ${C.border}`, borderRadius:'4px', fontSize:'12px', cursor:'pointer', letterSpacing:'0.06em', textTransform:'uppercase' as const, fontFamily:C.mono },
  btnDanger: { width:'100%', padding:'12px', background:'rgba(255,53,53,0.08)', color:C.danger, border:'1px solid rgba(255,53,53,0.25)', borderRadius:'4px', fontSize:'11px', fontWeight:700, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' as const, fontFamily:C.mono },
  btnSlash:  { width:'100%', padding:'16px', background:'linear-gradient(135deg,rgba(255,53,53,0.15),rgba(255,100,0,0.08))', color:C.danger, border:'1px solid rgba(255,53,53,0.5)', borderRadius:'4px', fontSize:'12px', fontWeight:700, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' as const, fontFamily:C.mono },
  alertErr:  { background:'rgba(255,53,53,0.06)', border:'1px solid rgba(255,53,53,0.2)', borderRadius:'4px', padding:'12px 14px', fontSize:'12px', color:'#ff7070', marginBottom:'16px' },
  alertOk:   { background:'rgba(184,255,0,0.04)', border:'1px solid rgba(184,255,0,0.2)', borderRadius:'4px', padding:'12px 14px', fontSize:'12px', color:C.accent, marginBottom:'16px' },
  secLbl:    { fontSize:'10px', fontWeight:600, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' },
  privRow:   { display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'10px', marginBottom:'16px' },
  empty:     { textAlign:'center' as const, padding:'48px 20px', color:C.dim, fontSize:'13px' },
  cwrap:     { display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', minHeight:'60vh', textAlign:'center' as const, gap:'20px' },
  blur:      { filter:'blur(6px)', userSelect:'none' as const, pointerEvents:'none' as const },
  actions:   { display:'grid', gap:'8px', marginTop:'16px' },
  demoBox:   { padding:'10px 14px', background:'rgba(184,255,0,0.04)', border:'1px solid rgba(184,255,0,0.1)', borderRadius:'4px', fontSize:'11px', color:C.mid, marginBottom:'16px', lineHeight:1.7 },
  tourBtn:   { background:'none', border:`1px solid ${C.border}`, borderRadius:'100px', padding:'5px 12px', fontSize:'10px', letterSpacing:'0.1em', color:C.dim, cursor:'pointer', fontFamily:"'DM Mono','Courier New',monospace", textTransform:'uppercase' as const },
};

// ── Countdown Ring ────────────────────────────────────────────
function CountdownRing({ deadlineTs, totalSeconds }: { deadlineTs: number; totalSeconds: number }) {
  const { overdue, h, m, s, seconds } = useCountdown(deadlineTs);
  const R = 26, circ = 2 * Math.PI * R;
  const pct = overdue ? 0 : Math.min(seconds / Math.max(totalSeconds, 1), 1);
  const color = overdue ? C.danger : seconds < 30 ? '#ffaa00' : C.accent;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', minWidth:'72px' }}>
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

// ── Toggle ────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{ width:'34px', height:'19px', borderRadius:'100px', background: on ? 'rgba(184,255,0,0.25)' : 'rgba(255,255,255,0.07)', border: on ? '1px solid rgba(184,255,0,0.4)' : `1px solid ${C.border}`, position:'relative', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:'2px', left: on ? '15px' : '2px', width:'13px', height:'13px', borderRadius:'50%', background: on ? C.accent : C.dim, transition:'left 0.2s, background 0.2s' }} />
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
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

// ── Trade Card ────────────────────────────────────────────────
function TradeCard({ trade, account, privacy, txLoading, onExec }: {
  trade: Trade;
  account: string;
  privacy: boolean;
  txLoading: string | null;
  onExec: (id: string, method: string, opts?: any) => void;
}) {
  const { overdue } = useCountdown(trade.deadline);
  const isBuyer    = account.toLowerCase() === trade.buyer.toLowerCase();
  const isSeller   = account.toLowerCase() === trade.seller.toLowerCase();
  const stateIdx   = STATE_LABELS.indexOf(trade.state);
  const isTerminal = trade.state === 'Completed' || trade.state === 'Cancelled';
  // Slashing only valid on Funded or InTransit — NOT Delivered (buyer should just completeTrade)
  const canSlash   = overdue && (trade.state === 'Funded' || trade.state === 'InTransit') && isBuyer && !trade.sellerSlashed && trade.state !== 'Delivered';
  const isActing   = txLoading === trade.id;
  const totalSecs  = Math.max(trade.deadline - trade.createdAt, 1);

  return (
    <div style={{ background: overdue && !isTerminal ? 'rgba(255,53,53,0.03)' : C.surface, border:`1px solid ${overdue && !isTerminal ? 'rgba(255,53,53,0.22)' : C.border}`, borderRadius:'8px', padding:'20px 22px', marginBottom:'12px', transition:'border-color 0.4s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
        <span style={{ fontSize:'11px', color:C.dim, fontFamily:C.mono }}>ID {trade.id.slice(0,10)}…{trade.id.slice(-6)}</span>
        <Badge state={trade.state} />
      </div>

      {trade.state !== 'Cancelled' && (
        <div style={{ display:'flex', alignItems:'center', marginBottom:'18px', overflowX:'auto' }}>
          {(['Created','Funded','InTransit','Delivered','Completed'] as TradeState[]).map((s, i, arr) => {
            const past = stateIdx > i, act = stateIdx === i;
            const col = past || act ? C.accent : 'rgba(255,255,255,0.1)';
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', flex: i < arr.length-1 ? '1 1 auto' : '0 0 auto' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:col, boxShadow: act ? `0 0 8px ${C.accent}` : 'none', transition:'all 0.3s' }} />
                  <span style={{ fontSize:'8px', letterSpacing:'0.08em', color: act ? C.accent : past ? C.mid : C.dim, textTransform:'uppercase', whiteSpace:'nowrap', fontFamily:C.mono }}>{s}</span>
                </div>
                {i < arr.length-1 && <div style={{ flex:'1 1 auto', height:'1px', background: past ? C.accent : C.border, minWidth:'14px', marginBottom:'12px', transition:'background 0.3s' }} />}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'20px', alignItems:'center', marginBottom:'14px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:'14px' }}>
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
        {!isTerminal && <CountdownRing deadlineTs={trade.deadline} totalSeconds={totalSecs} />}
      </div>

      {!isTerminal && (
        <div style={S.actions}>
          {canSlash && (
            <button style={{ ...S.btnSlash, animation:'slashPulse 1.6s ease-in-out infinite' }}
              onClick={() => onExec(trade.id, 'slashSellerAndComplete')} disabled={isActing}>
              {isActing ? '⏳ Processing…' : `⚡ INITIATE SLASHING PROTOCOL — SEIZE ${trade.slashingPenaltyBps/100}%`}
            </button>
          )}
          {isBuyer && trade.state === 'Created' && (
            <button style={S.btnGhost} onClick={() => onExec(trade.id, 'fundTrade', { value: trade.amount })} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Fund Escrow ]'}
            </button>
          )}
          {isBuyer && trade.state === 'Delivered' && (
            <button style={{ ...S.btnPrimary, background: 'rgba(0,200,100,0.15)', color: '#00cc77', border: '1px solid rgba(0,200,100,0.4)' }}
              onClick={() => onExec(trade.id, 'completeTrade')} disabled={isActing}>
              {isActing ? 'Processing…' : '✓ Release Payment to Seller'}
            </button>
          )}
          {isBuyer && (trade.state === 'Created' || trade.state === 'Funded') && (
            <button style={S.btnDanger} onClick={() => onExec(trade.id, 'cancelTrade')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Cancel Trade ]'}
            </button>
          )}
          {isSeller && trade.state === 'Funded' && (
            <button style={S.btnGhost} onClick={() => onExec(trade.id, 'updateStatusInTransit')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Mark In Transit ]'}
            </button>
          )}
          {isSeller && trade.state === 'InTransit' && (
            <button style={S.btnGhost} onClick={() => onExec(trade.id, 'updateStatusDelivered')} disabled={isActing}>
              {isActing ? 'Processing…' : '[ Confirm Delivery ]'}
            </button>
          )}
          {isSeller && trade.state === 'Created' && (
            <button style={S.btnDanger} onClick={() => onExec(trade.id, 'cancelTrade')} disabled={isActing}>
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

// ── Main ──────────────────────────────────────────────────────
export default function Home() {
  const [account,       setAccount]       = useState<string|null>(null);
  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [error,         setError]         = useState<string|null>(null);
  const [success,       setSuccess]       = useState<string|null>(null);
  const [loading,       setLoading]       = useState(false);
  const [privacy,       setPrivacy]       = useState(false);
  const [txLoading,     setTxLoading]     = useState<string|null>(null);
  const [demoMode,      setDemoMode]      = useState(true);
  const [showTour,      setShowTour]      = useState(false);

  const [seller,   setSeller]   = useState('');
  const [amount,   setAmount]   = useState('');
  const [deadline, setDeadline] = useState('60');
  const [penalty,  setPenalty]  = useState('100');

  // ── CHANGED: Sepolia (chainId 11155111) instead of Hardhat local ──
  const getProvider = useCallback(() => {
    const w = window as any;
    return new ethers.providers.Web3Provider(w.ethereum, { chainId: 11155111, name: 'sepolia' });
  }, []);

  const getContract = useCallback((signer = false) => {
    const p = getProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer ? p.getSigner() : p);
  }, [getProvider]);

  const loadTrades = useCallback(async (addr: string) => {
    try {
      setLoadingTrades(true);
      const c = getContract();
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
        } catch { /* skip malformed */ }
      }
      setTrades(loaded.reverse());
    } catch { /* ignore */ }
    finally { setLoadingTrades(false); }
  }, [getContract]);

  const connectWallet = async () => {
    try {
      const w = window as any;
      if (!w.ethereum) { setError('MetaMask not found.'); return; }
      // ── CHANGED: Switch to Sepolia (0xaa36a7) instead of Hardhat (0x7a69) ──
      try {
        await w.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
      } catch (se: any) {
        if (se.code === 4902) {
          await w.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/27oAgPRymuzZapzM6msqe'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
        }
      }
      const accs = await w.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accs[0]); setError(null);
      await loadTrades(accs[0]);
      // Show tour for first-time users
      const toured = localStorage.getItem('iron-ledger-toured');
      if (!toured) setShowTour(true);
    } catch (e: any) {
      const m = String(e?.message || '');
      if (!m.includes('ENS') && !m.includes('getResolver')) setError('Failed: ' + m.slice(0, 100));
    }
  };

  const createTrade = async () => {
    if (!seller || !amount || !deadline || !penalty) { setError('All fields required.'); return; }
    try {
      setLoading(true); setError(null); setSuccess(null);
      const c = getContract(true);
      const secs = demoMode ? parseInt(deadline) : parseInt(deadline) * 86400;
      const deadlineTs = Math.floor(Date.now() / 1000) + secs;
      const wei = ethers.utils.parseEther(amount);
      const tx = await c.createTrade(seller, wei, deadlineTs, parseInt(penalty));
      setSuccess('Submitted — confirming…');
      await tx.wait();
      setSuccess(`Trade created ✓  ${tx.hash.slice(0, 20)}…`);
      setSeller(''); setAmount(''); setDeadline(demoMode ? '60' : '7'); setPenalty('100');
      await loadTrades(account!);
    } catch (e: any) { setError(String(e?.message || e?.reason || 'Failed').slice(0, 150)); }
    finally { setLoading(false); }
  };

  const exec = async (id: string, method: string, opts: any = {}) => {
    try {
      setTxLoading(id); setError(null); setSuccess(null);
      const c = getContract(true);
      let tx;
      if (method === 'fundTrade') {
        // fundTrade(bytes32 id) — ETH value goes as tx override only
        const valueWei = ethers.BigNumber.from(opts.value ?? '0');
        tx = await c.fundTrade(id, { value: valueWei });
      } else {
        // All other methods: just pass the id, no extra args
        tx = await c[method](id);
      }
      setSuccess('Submitted — confirming…');
      await tx.wait();
      setSuccess(`${method} confirmed ✓`);
      await loadTrades(account!);
    } catch (e: any) { setError(String(e?.message || e?.reason || 'Failed').slice(0, 150)); }
    finally { setTxLoading(null); }
  };

  const handleTourDone = () => {
    setShowTour(false);
    localStorage.setItem('iron-ledger-toured', '1');
  };

  const nowSec     = Math.floor(Date.now() / 1000);
  const active     = trades.filter(t => !['Completed','Cancelled'].includes(t.state)).length;
  const lockedWei  = trades.filter(t => ['Funded','InTransit','Delivered'].includes(t.state)).reduce((a, t) => a + BigInt(t.amount), 0n);
  const lockedEth  = parseFloat(ethers.utils.formatEther(lockedWei.toString())).toFixed(3);
  const overdueCnt = trades.filter(t => t.deadline < nowSec && ['Funded','InTransit'].includes(t.state)).length;

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
      ::-webkit-scrollbar{width:3px;height:3px}
      ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <>
      {/* Tour overlay — renders above everything */}
      {showTour && <IronLedgerTour onDone={handleTourDone} />}

      <div style={S.grid} />
      <main style={S.root}>
        <div style={S.page}>

          {/* ── Header ── */}
          <header data-tour="header" style={S.header}>
            <div style={S.hrow}>
              <div>
                <div style={S.eyebrow}>Iron Ledger Protocol v1</div>
                <h1 style={S.title}>The Iron Ledger</h1>
                <p style={S.subtitle}>Autonomous Arbitration &amp; Escrow — On-Chain · Sepolia Testnet</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' as const }}>
                {account && (
                  <>
                    <button
                      style={S.tourBtn}
                      onClick={() => setShowTour(true)}
                      title="Replay guided tour"
                    >
                      ◎ Tour
                    </button>
                    <div style={S.chip}>
                      <div style={S.chipDot} />
                      <span style={{ fontSize:'12px', color:C.mid }}>{shortenAddr(account)}</span>
                      <button style={S.chipX} onClick={() => { setAccount(null); setTrades([]); }}>✕</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* ── Connect screen ── */}
          {!account && (
            <div style={S.cwrap}>
              <div style={{ fontSize:'52px' }}>⚖</div>
              <div>
                <p style={{ ...S.title, margin:'0 0 8px' }}>Connect to The Iron Ledger</p>
                <p style={{ fontSize:'13px', color:C.dim, margin:0, maxWidth:'340px', lineHeight:1.7 }}>
                  Trustless commodity escrow with live countdown enforcement.<br />
                  MetaMask on Sepolia Testnet (chain 11155111).
                </p>
              </div>
              <button style={{ ...S.btnPrimary, width:'auto', padding:'14px 36px' }} onClick={connectWallet}>Connect Wallet</button>
              {error && <div style={{ ...S.alertErr, maxWidth:'400px' }}>{error}</div>}
            </div>
          )}

          {account && (
            <>
              {/* ── Stats bar ── */}
              <div data-tour="stats" style={S.stats}>
                <div style={S.statCell}>
                  <div style={S.statNum}>{active}</div>
                  <div style={S.statLbl}>Active Trades</div>
                </div>
                <div style={S.statCell}>
                  <div style={{ ...S.statNum, ...(privacy ? S.blur : {}) }}>{lockedEth} ETH</div>
                  <div style={S.statLbl}>In Escrow</div>
                </div>
                <div style={S.statCell}>
                  <div style={{ ...S.statNum, color: overdueCnt > 0 ? C.danger : C.accent }}>{overdueCnt}</div>
                  <div style={S.statLbl}>Overdue</div>
                </div>
              </div>

              {error   && <div style={S.alertErr}>{error}</div>}
              {success && <div style={S.alertOk}>{success}</div>}

              {/* ── New Trade Panel ── */}
              <div data-tour="new-trade" style={S.panel}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'22px' }}>
                  <p style={{ fontSize:'14px', fontWeight:600, color:'#f0ede8', margin:0 }}>New Trade</p>
                  <div data-tour="demo-toggle" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'10px', letterSpacing:'0.1em', color: demoMode ? C.accent : C.dim, textTransform:'uppercase' }}>
                      {demoMode ? '⚡ Demo (seconds)' : '🏭 Production (days)'}
                    </span>
                    <Toggle on={demoMode} onChange={() => { setDemoMode(d => !d); setDeadline(demoMode ? '7' : '60'); }} />
                  </div>
                </div>

                <div style={S.fg}>
                  <label style={S.lbl}>Seller Address</label>
                  <input style={S.input} type="text" placeholder="0x…" value={seller} onChange={e => setSeller(e.target.value)} />
                </div>
                <div style={S.fg}>
                  <label style={S.lbl}>Escrow Amount (ETH)</label>
                  <input style={S.input} type="number" placeholder="0.1" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div style={S.grid2}>
                  <div>
                    <label style={S.lbl}>Deadline ({demoMode ? 'seconds' : 'days'})</label>
                    <input style={S.input} type="number" placeholder={demoMode ? '60' : '7'} value={deadline} onChange={e => setDeadline(e.target.value)} />
                    <p style={S.hint}>{demoMode ? 'Live ring counts down to zero' : 'Days until delivery deadline'}</p>
                  </div>
                  <div>
                    <label style={S.lbl}>Penalty (bps)</label>
                    <input style={S.input} type="number" placeholder="100" value={penalty} onChange={e => setPenalty(e.target.value)} />
                    <p style={S.hint}>100 bps = 1% | max 255</p>
                  </div>
                </div>

                {demoMode && (
                  <div data-tour="demo-hint" style={S.demoBox}>
                    💡 <strong style={{ color:C.accent }}>Demo workflow:</strong> Set deadline to <strong style={{ color:C.accent }}>30</strong> seconds → Create Trade → Fund Escrow → watch the ring drain to zero → <strong style={{ color:C.danger }}>⚡ Slash button activates automatically</strong>. Note: Sepolia blocks confirm in ~12s so allow a few confirmations.
                  </div>
                )}

                <button
                  style={{ ...S.btnPrimary, opacity:loading ? 0.6 : 1, cursor:loading ? 'not-allowed' : 'pointer' }}
                  onClick={createTrade}
                  disabled={loading}
                >
                  {loading ? 'Submitting…' : 'Create Trade'}
                </button>
              </div>

              {/* ── Active Ledger ── */}
              <div>
                <div style={S.privRow}>
                  <span data-tour="privacy-toggle" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'10px', letterSpacing:'0.12em', color:C.dim, textTransform:'uppercase' }}>Privacy Mode</span>
                    <Toggle on={privacy} onChange={() => setPrivacy(p => !p)} />
                  </span>
                </div>
                <div data-tour="active-ledger" style={S.secLbl}>Active Ledger</div>
                {loadingTrades && <div style={S.empty}>Loading trades from chain…</div>}
                {!loadingTrades && trades.length === 0 && <div style={S.empty}>No trades found.<br />Create one above to begin.</div>}
                {!loadingTrades && trades.map(t => (
                  <TradeCard
                    key={t.id}
                    trade={t}
                    account={account}
                    privacy={privacy}
                    txLoading={txLoading}
                    onExec={exec}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}