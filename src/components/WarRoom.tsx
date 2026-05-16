'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';

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

interface WarRoomProps {
  account: string;
  trades: Trade[];
  onBack: () => void;
  onTradeUpdate: () => void;
}

const C = {
  bg:      '#080909',
  surface: '#0f1011',
  border:  'rgba(255,255,255,0.06)',
  accent:  '#b8ff00',
  blue:    '#38bdf8',
  danger:  '#ff3535',
  orange:  '#fb923c',
  text:    '#ddd9d0',
  mid:     'rgba(255,255,255,0.4)',
  dim:     'rgba(255,255,255,0.18)',
  mono:    "'DM Mono','Courier New',monospace",
  serif:   "'DM Serif Display',Georgia,serif",
};

function shortenAddr(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }
function formatEth(wei: string)  { return parseFloat(ethers.utils.formatEther(wei)).toFixed(4); }

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function CountdownBar({ deadline, createdAt }: { deadline: number; createdAt: number }) {
  const now   = useNow();
  const total = Math.max(deadline - createdAt, 1);
  const left  = Math.max(deadline - now, 0);
  const pct   = Math.min((left / total) * 100, 100);
  const color = pct > 50 ? C.accent : pct > 20 ? C.orange : C.danger;
  return (
    <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88`, transition: 'width 1s linear, background 0.4s', borderRadius: 2 }} />
    </div>
  );
}

function TimeLeft({ deadline }: { deadline: number }) {
  const now  = useNow();
  const diff = deadline - now;
  if (diff <= 0) return <span style={{ color: C.danger, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', animation: 'wrFlash 1.2s ease-in-out infinite' }}>⚠ OVERDUE</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const color = diff < 60 ? C.danger : diff < 300 ? C.orange : C.accent;
  return <span style={{ color, fontFamily: C.mono, fontSize: 12, fontWeight: 600 }}>{h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}</span>;
}

const stateColor: Record<TradeState, string> = {
  Created: '#9999ff', Funded: '#b8ff00', InTransit: '#fb923c',
  Delivered: '#00cc77', Completed: 'rgba(255,255,255,0.4)', Cancelled: '#ff3535',
};

export default function WarRoom({ account, trades, onBack, onTradeUpdate }: WarRoomProps) {
  const now                  = useNow();
  const [slashing, setSlashing] = useState<string | null>(null);
  const [log, setLog]           = useState<{ text: string; color: string; ts: string }[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [lastTx, setLastTx]     = useState<string | null>(null);

  const addLog = (text: string, color = C.dim) => {
    const ts = new Date().toLocaleTimeString();
    setLog(prev => [{ text, color, ts }, ...prev].slice(0, 40));
  };

  const active = [...trades]
    .filter(t => !['Completed', 'Cancelled'].includes(t.state))
    .sort((a, b) => {
      const aOD = a.deadline < now && ['Funded','InTransit'].includes(a.state);
      const bOD = b.deadline < now && ['Funded','InTransit'].includes(b.state);
      if (aOD && !bOD) return -1;
      if (!aOD && bOD) return 1;
      return a.deadline - b.deadline;
    });

  const overdue = active.filter(t =>
    t.deadline < now && ['Funded','InTransit'].includes(t.state) && !t.sellerSlashed
  );

  const totalLocked = trades
    .filter(t => ['Funded','InTransit','Delivered'].includes(t.state))
    .reduce((s, t) => s + BigInt(t.amount), BigInt(0));

  const executeSlash = async (trade: Trade) => {
    if (!window.ethereum) return;
    setSlashing(trade.id); setError(null);
    addLog(`⚡ Initiating slash — ${trade.id.slice(0,10)}…`, C.orange);
    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider.getSigner());
      const tx = await contract.slashSellerAndComplete(trade.id);
      addLog(`📡 TX: ${tx.hash.slice(0,20)}…`, C.dim);
      await tx.wait();
      setLastTx(tx.hash);
      addLog(`✅ Slashed — ${(trade.slashingPenaltyBps/100).toFixed(2)}% seized from ${shortenAddr(trade.seller)}`, C.accent);
      onTradeUpdate();
    } catch (e: any) {
      const msg = String(e?.reason || e?.message || 'Unknown error').slice(0, 120);
      setError(msg);
      addLog(`❌ Failed: ${msg}`, C.danger);
    } finally {
      setSlashing(null);
    }
  };

  const slashAll = async () => { for (const t of overdue) await executeSlash(t); };

  return (
    <>
      <style>{`
        @keyframes wrFlash  { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes wrPulse  { 0%,100%{box-shadow:0 0 10px rgba(255,53,53,0.1)} 50%{box-shadow:0 0 30px rgba(255,53,53,0.5)} }
        @keyframes wrFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      `}</style>
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, display:'flex', flexDirection:'column', animation:'wrFadeIn 0.35s ease' }}>

        {/* Top bar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderBottom:`1px solid ${C.border}`, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(8px)', position:'sticky', top:0, zIndex:50, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <button onClick={onBack} style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.dim, padding:'6px 14px', borderRadius:4, cursor:'pointer', fontFamily:C.mono, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' }}>
              ← Ledger
            </button>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background: overdue.length>0 ? C.danger : C.accent, boxShadow:`0 0 8px ${overdue.length>0?C.danger:C.accent}`, animation: overdue.length>0 ? 'wrFlash 1.2s ease-in-out infinite' : 'none' }} />
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.15em', color: overdue.length>0 ? C.danger : C.accent }}>WAR ROOM</span>
              </div>
              <div style={{ fontSize:9, color:C.dim, letterSpacing:'0.1em' }}>LIVE LIQUIDATION DASHBOARD</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            {[
              { label:'OVERDUE',    value: overdue.length,                                                                                   color: overdue.length>0 ? C.danger : C.dim },
              { label:'ACTIVE',     value: active.length,                                                                                    color: C.accent },
              { label:'ETH LOCKED', value: parseFloat(ethers.utils.formatEther(totalLocked.toString())).toFixed(3),                          color: C.blue  },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:18, fontFamily:C.serif, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:8, letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
            {overdue.length > 1 && (
              <button onClick={slashAll} disabled={slashing!==null} style={{ padding:'7px 16px', background:'rgba(255,53,53,0.08)', border:'1px solid rgba(255,53,53,0.4)', color:C.danger, borderRadius:4, cursor: slashing!==null?'not-allowed':'pointer', fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', animation: slashing===null?'wrPulse 1.6s ease-in-out infinite':'none' }}>
                ⚡ SLASH ALL ({overdue.length})
              </button>
            )}
            {account && <div style={{ padding:'5px 12px', background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:100, fontSize:10, color:C.dim }}>{shortenAddr(account)}</div>}
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:1, background:C.border, borderBottom:`1px solid ${C.border}` }}>
          {[
            { label:'Total',     value: trades.length,                                             color:C.text    },
            { label:'Funded',    value: trades.filter(t=>t.state==='Funded').length,               color:C.accent  },
            { label:'In Transit',value: trades.filter(t=>t.state==='InTransit').length,            color:C.orange  },
            { label:'Slashed',   value: trades.filter(t=>t.sellerSlashed).length,                  color:C.danger  },
            { label:'Completed', value: trades.filter(t=>t.state==='Completed').length,            color:'#00cc77' },
          ].map(({label,value,color}) => (
            <div key={label} style={{ background:C.bg, padding:'12px 16px', textAlign:'center' }}>
              <div style={{ fontSize:18, fontFamily:C.serif, fontWeight:700, color, lineHeight:1, marginBottom:3 }}>{value}</div>
              <div style={{ fontSize:9, letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Main area */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 268px', overflow:'hidden' }}>

          {/* Trade queue */}
          <div style={{ overflowY:'auto', padding:'20px 24px', borderRight:`1px solid ${C.border}` }}>

            {error && <div style={{ background:'rgba(255,53,53,0.06)', border:'1px solid rgba(255,53,53,0.2)', borderRadius:4, padding:'10px 14px', fontSize:12, color:'#ff7070', marginBottom:14 }}>{error}</div>}
            {lastTx && <div style={{ display:'flex', justifyContent:'space-between', background:'rgba(184,255,0,0.04)', border:'1px solid rgba(184,255,0,0.2)', borderRadius:4, padding:'10px 14px', fontSize:12, color:C.accent, marginBottom:14 }}><span>✓ Slashing executed</span><span style={{ fontSize:10, color:C.dim }}>{lastTx.slice(0,18)}…</span></div>}

            {active.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:C.dim, border:`1px solid ${C.border}`, borderRadius:8 }}>
                <div style={{ fontSize:36, marginBottom:12, opacity:0.15 }}>⚔</div>
                <div style={{ fontSize:13 }}>No active trades</div>
                <div style={{ fontSize:11, marginTop:6, opacity:0.5 }}>All clear — no liquidations pending</div>
              </div>
            )}

            {active.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 88px 80px 90px 148px', gap:8, padding:'6px 14px', fontSize:8, letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase', borderBottom:`1px solid ${C.border}`, marginBottom:8 }}>
                <div>Trade ID</div><div>Amount</div><div>Penalty</div><div>State</div><div>Time Left</div><div>Action</div>
              </div>
            )}

            {active.map(trade => {
              const isOverdue  = trade.deadline < now && ['Funded','InTransit'].includes(trade.state) && !trade.sellerSlashed;
              const canSlash   = isOverdue && account.toLowerCase() === trade.buyer.toLowerCase();
              const isSlashing = slashing === trade.id;
              const showBar    = ['Funded','InTransit','Delivered'].includes(trade.state) && !isOverdue;

              return (
                <div key={trade.id} style={{ background: isOverdue ? 'rgba(255,53,53,0.025)' : C.surface, border:`1px solid ${isOverdue ? 'rgba(255,53,53,0.25)' : C.border}`, borderRadius:6, padding:'12px 14px', marginBottom:8, transition:'border-color 0.3s' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 88px 80px 90px 148px', gap:8, alignItems:'center' }}>

                    <div>
                      <div style={{ fontSize:10, color:C.dim, fontFamily:C.mono }}>{trade.id.slice(0,10)}…{trade.id.slice(-6)}</div>
                      <div style={{ fontSize:9, color:C.dim, marginTop:2 }}>{shortenAddr(trade.buyer)} → {shortenAddr(trade.seller)}</div>
                    </div>

                    <div style={{ fontSize:12, color:C.accent, fontFamily:C.mono, fontWeight:600 }}>
                      {formatEth(trade.amount)}<span style={{ fontSize:9, color:C.dim }}> ETH</span>
                    </div>

                    <div>
                      <div style={{ fontSize:11, color:C.orange, fontFamily:C.mono }}>{(trade.slashingPenaltyBps/100).toFixed(2)}%</div>
                      <div style={{ fontSize:9, color:C.dim }}>{(parseFloat(formatEth(trade.amount))*trade.slashingPenaltyBps/10000).toFixed(5)} ETH</div>
                    </div>

                    <div>
                      <span style={{ fontSize:9, padding:'2px 8px', background:`${stateColor[trade.state]}15`, border:`1px solid ${stateColor[trade.state]}33`, borderRadius:100, color:stateColor[trade.state], fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                        {trade.state}
                      </span>
                    </div>

                    <div><TimeLeft deadline={trade.deadline} /></div>

                    <div>
                      {canSlash ? (
                        <button onClick={() => executeSlash(trade)} disabled={isSlashing||slashing!==null} style={{ width:'100%', padding:'7px 10px', background:'rgba(255,53,53,0.08)', border:'1px solid rgba(255,53,53,0.4)', color:C.danger, borderRadius:4, cursor: isSlashing?'wait':'pointer', fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', animation: !isSlashing&&slashing===null?'wrPulse 1.6s ease-in-out infinite':'none' }}>
                          {isSlashing ? '⏳ Slashing…' : '⚡ SLASH'}
                        </button>
                      ) : isOverdue && !canSlash ? (
                        <span style={{ fontSize:9, color:'rgba(255,53,53,0.5)' }}>OVERDUE<br/>(not buyer)</span>
                      ) : trade.sellerSlashed ? (
                        <span style={{ fontSize:9, color:C.dim }}>SLASHED ✓</span>
                      ) : (
                        <span style={{ fontSize:9, color:C.dim }}>MONITORING</span>
                      )}
                    </div>
                  </div>
                  {showBar && <CountdownBar deadline={trade.deadline} createdAt={trade.createdAt} />}
                </div>
              );
            })}
          </div>

          {/* Activity log */}
          <div style={{ display:'flex', flexDirection:'column', background:C.surface, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' }}>▸ Activity Log</span>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:C.accent, animation:'wrFlash 2s ease-in-out infinite' }} />
                <span style={{ fontSize:9, color:C.accent }}>LIVE</span>
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'8px 14px', scrollbarWidth:'thin', scrollbarColor:'#1e293b transparent' }}>
              {log.length === 0 && <div style={{ textAlign:'center', paddingTop:24, fontSize:11, color:C.dim }}>Awaiting activity…</div>}
              {log.map((entry, i) => (
                <div key={i} style={{ padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:10, lineHeight:1.5, opacity: Math.max(0.3, 1 - i * 0.06) }}>
                  <div style={{ color:C.dim, fontSize:9, marginBottom:2 }}>{entry.ts}</div>
                  <div style={{ color:entry.color }}>{entry.text}</div>
                </div>
              ))}
            </div>
            {overdue.length > 0 && (
              <div style={{ padding:'12px 14px', borderTop:'1px solid rgba(255,53,53,0.2)', background:'rgba(255,53,53,0.03)' }}>
                <div style={{ fontSize:9, color:C.danger, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>⚠ {overdue.length} Overdue</div>
                {overdue.map(t => (
                  <div key={t.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:10 }}>
                    <span style={{ color:C.dim, fontFamily:C.mono }}>{t.id.slice(0,10)}…</span>
                    <span style={{ color:C.orange }}>{formatEth(t.amount)} ETH</span>
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