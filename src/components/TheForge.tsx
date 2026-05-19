'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';

const C = {
  bg:      '#07080a',
  surface: '#0d0f11',
  panel:   '#0f1114',
  border:  'rgba(255,255,255,0.055)',
  accent:  '#b8ff00',
  blue:    '#38bdf8',
  purple:  '#a78bfa',
  danger:  '#ff3535',
  orange:  '#fb923c',
  text:    '#ddd9d0',
  mid:     'rgba(255,255,255,0.38)',
  dim:     'rgba(255,255,255,0.16)',
  mono:    "'DM Mono','Courier New',monospace",
  serif:   "'DM Serif Display',Georgia,serif",
};

interface Trade {
  id: string;
  buyer: string;
  seller: string;
  amount: string;
  deadline: number;
  createdAt: number;
  state: string;
  slashingPenaltyBps: number;
  sellerSlashed: boolean;
}

interface ForgeProps {
  account: string;
  trades: Trade[];
  onBack: () => void;
  onCreated: () => void;
  getProvider: () => ethers.providers.Web3Provider; // ← ADDED
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

function DeadlineRingPreview({ seconds, demoMode }: { seconds: number; demoMode: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const id = setInterval(() => {
      setElapsed(e => {
        if (e >= seconds) { setRunning(false); return seconds; }
        return e + 1;
      });
    }, demoMode ? 100 : 1000);
    return () => clearInterval(id);
  }, [running, seconds, demoMode]);

  const R = 54, circ = 2 * Math.PI * R;
  const remaining = Math.max(seconds - elapsed, 0);
  const pct = remaining / Math.max(seconds, 1);
  const overdue = remaining === 0 && running === false && elapsed > 0;
  const color = overdue ? C.danger : pct < 0.2 ? '#ffaa00' : C.accent;

  const fmt = (s: number) => {
    if (s >= 86400) return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h`;
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
      <div style={{ position:'relative', width:120, height:120 }}>
        <svg width="120" height="120" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
          <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
            style={{ transition:'stroke-dasharray 0.3s linear, stroke 0.3s' }}
          />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
          {overdue ? (
            <span style={{ fontSize:13, color:C.danger, fontWeight:700, fontFamily:C.mono, animation:'overdueFlash 1.2s ease-in-out infinite' }}>OVERDUE</span>
          ) : (
            <>
              <span style={{ fontSize:elapsed>0?18:14, color, fontWeight:700, fontFamily:C.mono }}>{elapsed>0?fmt(remaining):fmt(seconds)}</span>
              <span style={{ fontSize:8, color:C.dim, letterSpacing:'0.12em', textTransform:'uppercase' }}>{elapsed>0?'remaining':'total'}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>{setElapsed(0);setRunning(true);}} disabled={running}
          style={{ padding:'8px 16px', background:running?'rgba(184,255,0,0.04)':'rgba(184,255,0,0.12)', border:`1px solid rgba(184,255,0,${running?'0.1':'0.3'})`, borderRadius:4, color:running?'rgba(184,255,0,0.3)':C.accent, fontSize:11, fontFamily:C.mono, letterSpacing:'0.1em', cursor:running?'not-allowed':'pointer', textTransform:'uppercase', minHeight:'40px' }}>
          ▶ Preview
        </button>
        <button onClick={()=>{setElapsed(0);setRunning(false);}}
          style={{ padding:'8px 16px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:4, color:C.dim, fontSize:11, fontFamily:C.mono, letterSpacing:'0.1em', cursor:'pointer', textTransform:'uppercase', minHeight:'40px' }}>
          ↺ Reset
        </button>
      </div>
    </div>
  );
}

function PenaltyDial({ bps, onChange }: { bps: number; onChange: (v: number) => void }) {
  const pct = bps / 255;
  const R = 38, circ = 2 * Math.PI * R;
  const arcLen = pct * circ * 0.75;
  const color = bps > 150 ? C.danger : bps > 80 ? C.orange : C.accent;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      <div style={{ position:'relative', width:100, height:100 }}>
        <svg width="100" height="100" style={{ transform:'rotate(135deg)' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5"
            strokeDasharray={`${circ*0.75} ${circ}`} strokeLinecap="round" />
          <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
            style={{ transition:'all 0.2s' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:16, fontWeight:700, color, fontFamily:C.mono }}>{(bps/100).toFixed(1)}%</span>
          <span style={{ fontSize:7, color:C.dim, letterSpacing:'0.1em' }}>PENALTY</span>
        </div>
      </div>
      <input type="range" min="10" max="255" value={bps} onChange={e=>onChange(Number(e.target.value))}
        style={{ width:'100%', accentColor:color }} />
      <div style={{ display:'flex', justifyContent:'space-between', width:'100%' }}>
        <span style={{ fontSize:8, color:C.dim }}>0.1%</span>
        <span style={{ fontSize:8, color:C.dim }}>2.55%</span>
      </div>
    </div>
  );
}

function ContractPreview({ seller, amountEth, deadlineSecs, penaltyBps, demoMode, account }: {
  seller:string; amountEth:string; deadlineSecs:string; penaltyBps:number; demoMode:boolean; account:string;
}) {
  const deadlineTs = Math.floor(Date.now()/1000) + (demoMode ? Number(deadlineSecs) : Number(deadlineSecs)*86400);
  const deadlineStr = new Date(deadlineTs*1000).toISOString().replace('T',' ').slice(0,19)+' UTC';
  const penaltyPct = (penaltyBps/100).toFixed(2);
  const amountWei = amountEth && !isNaN(Number(amountEth)) ? (()=>{try{return ethers.utils.parseEther(amountEth).toString();}catch{return '—';}})() : '—';
  const penaltyEth = amountEth && !isNaN(Number(amountEth)) && !isNaN(penaltyBps) ? (Number(amountEth)*penaltyBps/10000).toFixed(6) : '—';

  const line = (label:string, value:string, highlight?:boolean) => (
    <div key={label} style={{ display:'grid', gridTemplateColumns:'130px 1fr', gap:8, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
      <span style={{ fontSize:10, color:C.dim, fontFamily:C.mono }}>{label}</span>
      <span style={{ fontSize:10, color:highlight?C.accent:C.text, fontFamily:C.mono, wordBreak:'break-all' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background:'rgba(0,0,0,0.4)', border:`1px solid ${C.border}`, borderRadius:8, padding:'16px 18px', fontFamily:C.mono }}>
      <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.accent, textTransform:'uppercase', marginBottom:12 }}>▸ CONTRACT PREVIEW</div>
      {line('buyer (you)', account?account.slice(0,10)+'…'+account.slice(-6):'—')}
      {line('seller', seller?seller.slice(0,10)+'…'+seller.slice(-6):'— (required)')}
      {line('amount', amountEth?`${amountEth} ETH`:'— (required)', !!amountEth)}
      {line('deadline', deadlineSecs?deadlineStr:'—')}
      {line('penaltyBps', `${penaltyBps} bps = ${penaltyPct}%`)}
      {line('penalty ETH', penaltyEth!=='—'?`${penaltyEth} ETH at risk`:'—', penaltyEth!=='—')}
      <div style={{ marginTop:14, padding:'8px 10px', background:'rgba(184,255,0,0.03)', border:'1px solid rgba(184,255,0,0.1)', borderRadius:4, fontSize:10, color:C.dim, lineHeight:1.7 }}>
        If seller misses deadline, buyer seizes <span style={{ color:C.accent }}>{penaltyEth} ETH</span>.
      </div>
    </div>
  );
}

function GasEstimate({ amountEth }: { amountEth: string }) {
  const gasUnits=120000, gasPriceGwei=12, ethPrice=3820;
  const gasCostEth=(gasUnits*gasPriceGwei*1e-9).toFixed(6);
  const gasCostUsd=(gasUnits*gasPriceGwei*1e-9*ethPrice).toFixed(2);
  const totalEth=amountEth&&!isNaN(Number(amountEth))?(Number(amountEth)+Number(gasCostEth)).toFixed(6):'—';
  return (
    <div style={{ padding:'12px 14px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.15)', borderRadius:6, fontSize:11 }}>
      <div style={{ fontSize:9, color:C.blue, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10 }}>▸ GAS ESTIMATE</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', fontFamily:C.mono }}>
        <span style={{ color:C.dim, fontSize:10 }}>Gas Cost</span>
        <span style={{ color:C.blue, fontSize:10 }}>{gasCostEth} ETH (≈${gasCostUsd})</span>
        <span style={{ color:C.dim, fontSize:10 }}>Total</span>
        <span style={{ color:C.accent, fontSize:10, fontWeight:700 }}>{totalEth} ETH</span>
      </div>
    </div>
  );
}

function RecentRow({ trade }: { trade: Trade }) {
  const stateColor: Record<string,string> = { Created:'#9999ff', Funded:C.accent, InTransit:C.orange, Delivered:'#00cc77', Completed:C.mid, Cancelled:C.danger };
  const c = stateColor[trade.state]||C.dim;
  const eth = parseFloat(ethers.utils.formatEther(trade.amount)).toFixed(3);
  return (
    <div style={{ padding:'9px 0', borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
      <div>
        <div style={{ fontSize:10, color:C.dim, fontFamily:C.mono, marginBottom:2 }}>{trade.id.slice(0,8)}…</div>
        <div style={{ fontSize:13, color:C.accent, fontFamily:C.mono, fontWeight:600 }}>{eth} ETH</div>
      </div>
      <span style={{ fontSize:9, padding:'2px 8px', background:`${c}15`, border:`1px solid ${c}33`, borderRadius:100, color:c, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:C.mono }}>{trade.state}</span>
    </div>
  );
}

export default function TheForge({ account, trades, onBack, onCreated, getProvider }: ForgeProps) {
  const isMobile = useIsMobile();
  const [seller,       setSeller]       = useState('');
  const [amountEth,    setAmountEth]    = useState('');
  const [deadlineSecs, setDeadlineSecs] = useState('60');
  const [penaltyBps,   setPenaltyBps]   = useState(100);
  const [demoMode,     setDemoMode]     = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [txHash,       setTxHash]       = useState('');
  const [mobilePanel, setMobilePanel] = useState<'build'|'preview'|'history'>('build');

  const lbl: React.CSSProperties = { display:'block', fontSize:10, fontWeight:600, letterSpacing:'0.15em', color:C.dim, textTransform:'uppercase', marginBottom:8 };
  const inp: React.CSSProperties = { width:'100%', padding:'13px 14px', background:'rgba(255,255,255,0.025)', border:`1px solid ${C.border}`, borderRadius:4, fontSize:16, color:C.text, fontFamily:C.mono, outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' };

  const createTrade = async () => {
    if (!seller || !amountEth || !deadlineSecs) { setError('Seller address, amount and deadline are required.'); return; }
    try {
      setLoading(true); setError(''); setSuccess(''); setTxHash('');
      // ← FIXED: use getProvider() instead of window.ethereum directly
      const provider = getProvider();
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const secs = demoMode ? Number(deadlineSecs) : Number(deadlineSecs)*86400;
      const deadlineTs = Math.floor(Date.now()/1000)+secs;
      const wei = ethers.utils.parseEther(amountEth);
      const tx = await contract.createTrade(seller, wei, deadlineTs, penaltyBps);
      await tx.wait();
      setTxHash(tx.hash); setSuccess('Trade created successfully.');
      setSeller(''); setAmountEth(''); setDeadlineSecs('60'); setPenaltyBps(100);
      onCreated();
    } catch(e:any) {
      setError(String(e?.message||e?.reason||'Transaction failed').slice(0,160));
    } finally { setLoading(false); }
  };

  const recentTrades = trades.slice(0,6);

  // ── Mobile layout ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <style>{`
          @keyframes overdueFlash{0%,100%{opacity:1}50%{opacity:0.3}}
          .forge-inp:focus{border-color:rgba(184,255,0,0.35)!important}
          .forge-inp::placeholder{color:rgba(255,255,255,0.1)}
        `}</style>
        <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px' }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:`1px solid ${C.border}`, background:C.surface, position:'sticky', top:0, zIndex:50 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.dim, padding:'8px 12px', borderRadius:4, fontSize:10, fontFamily:C.mono, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase', minHeight:'36px' }}>← Back</button>
              <div>
                <div style={{ fontSize:8, letterSpacing:'0.18em', color:C.accent, textTransform:'uppercase' }}>Iron Ledger</div>
                <div style={{ fontSize:16, fontFamily:C.serif, color:'#f2ede6', fontWeight:700, lineHeight:1.1 }}>Contract Drafting</div>
              </div>
            </div>
            {/* Demo toggle */}
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:100 }}>
              <span style={{ fontSize:9, color:C.dim }}>{demoMode?'Sec':'Days'}</span>
              <div onClick={()=>{setDemoMode(d=>!d);setDeadlineSecs(demoMode?'7':'60');}}
                style={{ width:30, height:16, borderRadius:100, background:demoMode?'rgba(184,255,0,0.2)':'rgba(255,255,255,0.06)', border:`1px solid ${demoMode?'rgba(184,255,0,0.4)':C.border}`, position:'relative', cursor:'pointer', transition:'all 0.2s' }}>
                <div style={{ position:'absolute', top:2, left:demoMode?13:2, width:10, height:10, borderRadius:'50%', background:demoMode?C.accent:C.dim, transition:'left 0.2s,background 0.2s' }}/>
              </div>
            </div>
          </div>

          {/* Mobile panel tabs */}
          <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:C.surface, position:'sticky', top:'57px', zIndex:40 }}>
            {(['build','preview','history'] as const).map(p => (
              <div key={p} onClick={()=>setMobilePanel(p)} style={{ flex:1, padding:'10px', textAlign:'center', fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:mobilePanel===p?C.accent:C.dim, borderBottom:mobilePanel===p?`2px solid ${C.accent}`:'2px solid transparent', cursor:'pointer', transition:'all 0.15s' }}>
                {p==='build'?'Build':p==='preview'?'Preview':'History'}
              </div>
            ))}
          </div>

          <div style={{ padding:'20px 16px 80px' }}>
            {/* BUILD PANEL */}
            {mobilePanel === 'build' && (
              <div>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Seller Address</label>
                  <input className="forge-inp" style={inp} type="text" placeholder="0x…" value={seller} onChange={e=>setSeller(e.target.value)} autoCapitalize="none" autoCorrect="off" />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Escrow Amount (ETH)</label>
                  <input className="forge-inp" style={inp} type="number" placeholder="0.1" min="0" step="0.01" value={amountEth} onChange={e=>setAmountEth(e.target.value)} inputMode="decimal" />
                  {amountEth && !isNaN(Number(amountEth)) && <div style={{ fontSize:10, color:C.accent, marginTop:5 }}>≈ ${(Number(amountEth)*3820).toFixed(2)} USD</div>}
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={lbl}>Deadline ({demoMode?'seconds':'days'})</label>
                  <input className="forge-inp" style={inp} type="number" placeholder={demoMode?'60':'7'} min="1" value={deadlineSecs} onChange={e=>setDeadlineSecs(e.target.value)} inputMode="numeric" />
                  <div style={{ fontSize:10, color:C.dim, marginTop:5 }}>{demoMode?'⚡ Demo: set 30 for instant slash test':'🏭 Production: calendar days'}</div>
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={lbl}>Slashing Penalty</label>
                  <PenaltyDial bps={penaltyBps} onChange={setPenaltyBps} />
                  <div style={{ fontSize:10, color:C.dim, marginTop:8 }}>
                    {amountEth&&!isNaN(Number(amountEth))?`= ${(Number(amountEth)*penaltyBps/10000).toFixed(6)} ETH penalty`:'Enter amount to see ETH value.'}
                  </div>
                </div>
                <GasEstimate amountEth={amountEth} />
                {error && <div style={{ padding:'10px 14px', marginTop:14, background:'rgba(255,53,53,0.06)', border:'1px solid rgba(255,53,53,0.2)', borderRadius:4, fontSize:12, color:'#ff7070' }}>{error}</div>}
                {success && (
                  <div style={{ padding:'10px 14px', marginTop:14, background:'rgba(184,255,0,0.05)', border:'1px solid rgba(184,255,0,0.2)', borderRadius:4, fontSize:12, color:C.accent }}>
                    ✓ {success}{txHash&&<div style={{ fontSize:10, color:C.dim, marginTop:4 }}>tx: {txHash.slice(0,16)}…</div>}
                  </div>
                )}
                <button onClick={createTrade} disabled={loading||!account}
                  style={{ width:'100%', padding:'16px', marginTop:16, background:loading?'rgba(184,255,0,0.04)':C.accent, color:loading?C.accent:C.bg, border:loading?`1px solid rgba(184,255,0,0.2)`:'none', borderRadius:6, fontSize:14, fontWeight:700, cursor:loading||!account?'not-allowed':'pointer', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:C.mono, minHeight:'52px', opacity:!account?0.5:1 }}>
                  {!account?'Wallet Not Connected':loading?'⏳ Submitting…':'✦ Draft Trade Contract'}
                </button>
              </div>
            )}

            {/* PREVIEW PANEL */}
            {mobilePanel === 'preview' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'20px', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:4 }}>COUNTDOWN RING PREVIEW</div>
                  <DeadlineRingPreview seconds={Number(deadlineSecs)||60} demoMode={demoMode} />
                </div>
                <ContractPreview seller={seller} amountEth={amountEth} deadlineSecs={deadlineSecs} penaltyBps={penaltyBps} demoMode={demoMode} account={account} />
                {demoMode && (
                  <div style={{ padding:'12px 16px', background:'rgba(184,255,0,0.03)', border:'1px solid rgba(184,255,0,0.12)', borderRadius:6, fontSize:11, color:C.mid, lineHeight:1.8 }}>
                    <div style={{ color:C.accent, fontWeight:700, marginBottom:6, fontSize:10 }}>⚡ DEMO WORKFLOW</div>
                    1. Set deadline to <strong style={{ color:C.accent }}>30</strong>s<br/>
                    2. Draft Trade Contract<br/>
                    3. Fund in Ledger<br/>
                    4. Watch ring drain → <strong style={{ color:C.danger }}>⚡ Slash</strong>
                  </div>
                )}
              </div>
            )}

            {/* HISTORY PANEL */}
            {mobilePanel === 'history' && (
              <div>
                {trades.length > 0 && (
                  <div style={{ padding:'14px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, marginBottom:16 }}>
                    <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:12 }}>▸ YOUR STATS</div>
                    {[
                      ['Total Trades', trades.length],
                      ['Active', trades.filter(t=>!['Completed','Cancelled'].includes(t.state)).length],
                      ['Completed', trades.filter(t=>t.state==='Completed').length],
                      ['Overdue', trades.filter(t=>t.deadline<Math.floor(Date.now()/1000)&&!['Completed','Cancelled'].includes(t.state)).length],
                    ].map(([label,val])=>(
                      <div key={String(label)} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12, fontFamily:C.mono }}>
                        <span style={{ color:C.dim }}>{label}</span>
                        <span style={{ color:label==='Overdue'&&Number(val)>0?C.danger:C.accent, fontWeight:600 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:14 }}>▸ RECENT TRADES ({recentTrades.length})</div>
                {recentTrades.length===0 ? (
                  <div style={{ textAlign:'center', padding:'32px 16px', color:C.dim, fontSize:12 }}>No trades yet.</div>
                ) : recentTrades.map(t=><RecentRow key={t.id} trade={t}/>)}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Desktop layout ────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes overdueFlash{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes forgeFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .forge-inp:focus{border-color:rgba(184,255,0,0.35)!important}
        .forge-inp::placeholder{color:rgba(255,255,255,0.1)}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:2px}
      `}</style>
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px', animation:'forgeFadeIn 0.3s ease' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:`1px solid ${C.border}`, background:C.surface }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.dim, padding:'6px 12px', borderRadius:4, fontSize:10, fontFamily:C.mono, cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' }}>← Back</button>
            <div>
              <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.accent, textTransform:'uppercase', marginBottom:2 }}>Iron Ledger · Screen 03</div>
              <div style={{ fontSize:18, fontFamily:C.serif, color:'#f2ede6', fontWeight:700, letterSpacing:'-0.02em' }}>Contract Drafting</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:100 }}>
              <span style={{ fontSize:9, color:C.dim, textTransform:'uppercase', letterSpacing:'0.1em' }}>{demoMode?'Demo (secs)':'Production (days)'}</span>
              <div onClick={()=>{setDemoMode(d=>!d);setDeadlineSecs(demoMode?'7':'60');}} style={{ width:32, height:17, borderRadius:100, background:demoMode?'rgba(184,255,0,0.2)':'rgba(255,255,255,0.06)', border:`1px solid ${demoMode?'rgba(184,255,0,0.4)':C.border}`, position:'relative', cursor:'pointer', transition:'all 0.2s' }}>
                <div style={{ position:'absolute', top:2, left:demoMode?14:2, width:11, height:11, borderRadius:'50%', background:demoMode?C.accent:C.dim, transition:'left 0.2s,background 0.2s' }}/>
              </div>
            </div>
            {account && <div style={{ fontSize:11, color:C.mid, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:100, padding:'6px 14px' }}>{account.slice(0,6)}…{account.slice(-4)}</div>}
          </div>
        </div>

        {/* Three-column layout */}
        <div style={{ display:'grid', gridTemplateColumns:'340px 1fr 300px', gap:1, minHeight:'calc(100vh - 61px)', background:C.border }}>
          {/* LEFT: Builder */}
          <div style={{ background:C.bg, padding:'28px 24px', overflowY:'auto' }}>
            <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:20 }}>▸ CONTRACT PARAMETERS</div>
            <div style={{ marginBottom:18 }}>
              <label style={lbl}>Seller Address</label>
              <input className="forge-inp" style={inp} type="text" placeholder="0x…" value={seller} onChange={e=>setSeller(e.target.value)} />
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={lbl}>Escrow Amount (ETH)</label>
              <input className="forge-inp" style={inp} type="number" placeholder="0.1" min="0" step="0.01" value={amountEth} onChange={e=>setAmountEth(e.target.value)} />
              {amountEth&&!isNaN(Number(amountEth))&&<div style={{ fontSize:10, color:C.accent, marginTop:5 }}>≈ ${(Number(amountEth)*3820).toFixed(2)} USD</div>}
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={lbl}>Deadline ({demoMode?'seconds':'days'})</label>
              <input className="forge-inp" style={inp} type="number" placeholder={demoMode?'60':'7'} min="1" value={deadlineSecs} onChange={e=>setDeadlineSecs(e.target.value)} />
              <div style={{ fontSize:10, color:C.dim, marginTop:5 }}>{demoMode?'⚡ Demo: seconds. Set 30 for instant slash demo.':'🏭 Production: calendar days until delivery.'}</div>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={lbl}>Slashing Penalty</label>
              <PenaltyDial bps={penaltyBps} onChange={setPenaltyBps} />
              <div style={{ fontSize:10, color:C.dim, marginTop:8, lineHeight:1.6 }}>
                If seller misses deadline, this % is seized from escrow.<br/>
                {amountEth&&!isNaN(Number(amountEth))?`= ${(Number(amountEth)*penaltyBps/10000).toFixed(6)} ETH penalty`:'Enter amount to see ETH value.'}
              </div>
            </div>
            {error&&<div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(255,53,53,0.06)', border:'1px solid rgba(255,53,53,0.2)', borderRadius:4, fontSize:12, color:'#ff7070' }}>{error}</div>}
            {success&&<div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(184,255,0,0.05)', border:'1px solid rgba(184,255,0,0.2)', borderRadius:4, fontSize:12, color:C.accent }}>✓ {success}{txHash&&<div style={{ fontSize:10, color:C.dim, marginTop:4 }}>tx: {txHash.slice(0,16)}…</div>}</div>}
            <button onClick={createTrade} disabled={loading||!account} style={{ width:'100%', padding:'15px', background:loading?'rgba(184,255,0,0.04)':C.accent, color:loading?C.accent:C.bg, border:loading?`1px solid rgba(184,255,0,0.2)`:'none', borderRadius:4, fontSize:13, fontWeight:700, cursor:loading||!account?'not-allowed':'pointer', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:C.mono, transition:'all 0.2s', opacity:!account?0.5:1 }}>
              {!account?'Wallet Not Connected':loading?'⏳ Submitting to Chain…':'✦ Draft Trade Contract'}
            </button>
          </div>

          {/* CENTER: Preview */}
          <div style={{ background:C.panel, padding:'28px 28px', overflowY:'auto' }}>
            <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:20 }}>▸ LIVE CONTRACT PREVIEW</div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'24px', marginBottom:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:4 }}>COUNTDOWN RING PREVIEW</div>
              <DeadlineRingPreview seconds={Number(deadlineSecs)||60} demoMode={demoMode} />
            </div>
            <ContractPreview seller={seller} amountEth={amountEth} deadlineSecs={deadlineSecs} penaltyBps={penaltyBps} demoMode={demoMode} account={account} />
            {demoMode&&(
              <div style={{ marginTop:16, padding:'12px 16px', background:'rgba(184,255,0,0.03)', border:'1px solid rgba(184,255,0,0.12)', borderRadius:6, fontSize:11, color:C.mid, lineHeight:1.8 }}>
                <div style={{ color:C.accent, fontWeight:700, marginBottom:6, fontSize:10, letterSpacing:'0.1em' }}>⚡ DEMO WORKFLOW</div>
                1. Set deadline to <strong style={{ color:C.accent }}>30</strong> seconds<br/>
                2. Click <strong style={{ color:C.accent }}>Draft Trade Contract</strong><br/>
                3. Fund the trade in the Ledger<br/>
                4. Watch the ring drain to zero<br/>
                5. <strong style={{ color:C.danger }}>⚡ Execute Slashing Penalty</strong>
              </div>
            )}
          </div>

          {/* RIGHT: History + Gas */}
          <div style={{ background:C.bg, padding:'28px 20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:24 }}>
            <div>
              <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:14 }}>▸ COST BREAKDOWN</div>
              <GasEstimate amountEth={amountEth} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:14 }}>▸ RECENT TRADES ({recentTrades.length})</div>
              {recentTrades.length===0 ? (
                <div style={{ textAlign:'center', padding:'32px 16px', color:C.dim, fontSize:12, lineHeight:1.7 }}>No trades yet.<br/><span style={{ fontSize:10 }}>History appears after first forge.</span></div>
              ) : recentTrades.map(t=><RecentRow key={t.id} trade={t}/>)}
            </div>
            {trades.length>0&&(
              <div style={{ padding:'14px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:8 }}>
                <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:12 }}>▸ YOUR STATS</div>
                {[
                  ['Total Trades', trades.length],
                  ['Active', trades.filter(t=>!['Completed','Cancelled'].includes(t.state)).length],
                  ['Completed', trades.filter(t=>t.state==='Completed').length],
                  ['Overdue', trades.filter(t=>t.deadline<Math.floor(Date.now()/1000)&&!['Completed','Cancelled'].includes(t.state)).length],
                ].map(([label,val])=>(
                  <div key={String(label)} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.border}`, fontSize:11, fontFamily:C.mono }}>
                    <span style={{ color:C.dim }}>{label}</span>
                    <span style={{ color:label==='Overdue'&&Number(val)>0?C.danger:C.accent, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}