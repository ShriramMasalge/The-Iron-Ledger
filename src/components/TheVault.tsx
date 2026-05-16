'use client';

import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';

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

interface TheVaultProps {
  account: string;
  trades: Trade[];
  onBack: () => void;
}

const C = {
  bg:      '#080909',
  surface: '#0f1011',
  border:  'rgba(255,255,255,0.06)',
  accent:  '#b8ff00',
  danger:  '#ff3535',
  warn:    '#ffaa00',
  blue:    '#38bdf8',
  purple:  '#a78bfa',
  text:    '#ddd9d0',
  mid:     'rgba(255,255,255,0.4)',
  dim:     'rgba(255,255,255,0.18)',
  mono:    "'DM Mono','Courier New',monospace",
  serif:   "'DM Serif Display',Georgia,serif",
};

function formatEth(wei: string | bigint) {
  const w = typeof wei === 'bigint' ? wei.toString() : wei;
  return parseFloat(ethers.utils.formatEther(w)).toFixed(4);
}
function shortenAddr(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }

// ── Reputation Seal SVG ──────────────────────────────────────────
function IronSeal({ score }: { score: number }) {
  const tier = score >= 90 ? 'IRON' : score >= 70 ? 'BRONZE' : score >= 50 ? 'SILVER' : 'UNRANKED';
  const tierColor = score >= 90 ? C.accent : score >= 70 ? '#cd7f32' : score >= 50 ? '#c0c0c0' : C.dim;
  const rings = [44, 36, 28];
  const pct = score / 100;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Outer glow */}
        <defs>
          <filter id="sealGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="sealGlowStrong">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Background rings */}
        {rings.map((r, i) => (
          <circle key={i} cx="60" cy="60" r={r} fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"/>
        ))}
        {/* Progress arc - outer */}
        <circle cx="60" cy="60" r={44} fill="none"
          stroke={tierColor} strokeWidth="2.5" opacity="0.3"
          strokeDasharray={`${pct * 2 * Math.PI * 44} ${2 * Math.PI * 44}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ filter:`drop-shadow(0 0 4px ${tierColor})` }}
        />
        {/* Score arc - inner */}
        <circle cx="60" cy="60" r={28} fill="none"
          stroke={tierColor} strokeWidth="1.5" opacity="0.5"
          strokeDasharray={`${pct * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        {/* Center */}
        <circle cx="60" cy="60" r="18" fill={`${tierColor}10`} stroke={`${tierColor}30`} strokeWidth="1"/>
        {/* Hex icon */}
        <text x="60" y="65" textAnchor="middle" fontSize="18" fill={tierColor} style={{fontFamily:'serif'}}>⚖</text>
        {/* Corner marks */}
        {[0,90,180,270].map(deg => {
          const r2 = 44, angle = (deg - 90) * Math.PI / 180;
          const x = 60 + r2 * Math.cos(angle), y = 60 + r2 * Math.sin(angle);
          return <circle key={deg} cx={x} cy={y} r="2.5" fill={tierColor} opacity="0.7"/>;
        })}
      </svg>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'20px', fontWeight:700, color:tierColor, fontFamily:C.serif, letterSpacing:'-0.01em' }}>{score}</div>
        <div style={{ fontSize:'9px', letterSpacing:'0.22em', color:tierColor, textTransform:'uppercase', opacity:0.7 }}>{tier} RANK</div>
      </div>
    </div>
  );
}

// ── Mini sparkline chart ─────────────────────────────────────────
function Sparkline({ points, color = C.accent, height = 40 }: { points: number[]; color?: string; height?: number }) {
  if (points.length < 2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:C.dim }}>No data</div>;
  const w = 200, h = height;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const toY = (v: number) => h - ((v - min) / range) * (h - 6) - 3;
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${toY(v)}`).join(' ');
  const fill = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${toY(v)}`).join(' ') + ` L ${(points.length-1)*step} ${h} L 0 ${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sparkFill)"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(points.length-1)*step} cy={toY(points[points.length-1])} r="2.5" fill={color}/>
    </svg>
  );
}

// ── Bar chart ────────────────────────────────────────────────────
function BarChart({ data, color = C.accent }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', height:'60px' }}>
      {data.map(({ label, value }) => (
        <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
          <div style={{ width:'100%', background:color, opacity:0.8, borderRadius:'2px 2px 0 0', height:`${(value / max) * 48}px`, minHeight: value > 0 ? '4px' : '0', transition:'height 0.6s ease', boxShadow:`0 0 6px ${color}40` }}/>
          <div style={{ fontSize:'8px', color:C.dim, letterSpacing:'0.08em', textTransform:'uppercase' as const }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── State badge ──────────────────────────────────────────────────
function Badge({ state }: { state: TradeState }) {
  const map: Record<TradeState, [string, string]> = {
    Created:   ['rgba(120,120,255,0.1)', '#9999ff'],
    Funded:    ['rgba(184,255,0,0.07)', C.accent],
    InTransit: ['rgba(255,165,0,0.1)', '#ffaa00'],
    Delivered: ['rgba(0,200,100,0.1)', '#00cc77'],
    Completed: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.3)'],
    Cancelled: ['rgba(255,53,53,0.07)', '#ff6666'],
  };
  const [bg, color] = map[state];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', background:bg, color, border:`1px solid ${color}33`, borderRadius:'100px', fontSize:'9px', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' as const, fontFamily:C.mono }}>
      {state}
    </span>
  );
}

// ── Filter tab ───────────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background:'none', border:'none', padding:'6px 14px', fontSize:'10px', letterSpacing:'0.14em', textTransform:'uppercase' as const, fontFamily:C.mono, color: active ? C.accent : C.dim, borderBottom: active ? `1px solid ${C.accent}` : '1px solid transparent', cursor:'pointer', transition:'all 0.15s' }}>
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN VAULT COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function TheVault({ account, trades, onBack }: TheVaultProps) {
  const [filter, setFilter] = useState<'all' | 'buyer' | 'seller'>('all');
  const [sort, setSort]     = useState<'date' | 'amount'>('date');
  const [search, setSearch] = useState('');

  // ── Analytics ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const myTrades = trades;
    const completed  = myTrades.filter(t => t.state === 'Completed');
    const cancelled  = myTrades.filter(t => t.state === 'Cancelled');
    const slashed    = myTrades.filter(t => t.sellerSlashed);
    const asBuyer    = myTrades.filter(t => t.buyer.toLowerCase() === account.toLowerCase());
    const asSeller   = myTrades.filter(t => t.seller.toLowerCase() === account.toLowerCase());
    const active     = myTrades.filter(t => !['Completed','Cancelled'].includes(t.state));

    // Volume
    const totalVol = myTrades.reduce((a, t) => a + BigInt(t.amount), BigInt(0));
    const completedVol = completed.reduce((a, t) => a + BigInt(t.amount), BigInt(0));

    // On-time rate (completed without slashing)
    const onTimeCompleted = completed.filter(t => !t.sellerSlashed).length;
    const onTimeRate = completed.length > 0 ? Math.round((onTimeCompleted / completed.length) * 100) : 100;

    // Penalty ETH seized
    const penaltySeized = slashed.reduce((a, t) => {
      const penalty = BigInt(t.amount) * BigInt(t.slashingPenaltyBps) / BigInt(10000);
      return a + penalty;
    }, BigInt(0));

    // Reputation score: weighted composite
    const volScore     = Math.min(parseFloat(formatEth(totalVol.toString())) * 20, 30);  // max 30
    const onTimeScore  = onTimeRate * 0.4;                                                 // max 40
    const countScore   = Math.min(completed.length * 3, 20);                               // max 20
    const slashPenalty = slashed.length * 5;                                               // -5 per slash
    const rawScore     = Math.max(0, Math.round(volScore + onTimeScore + countScore - slashPenalty));
    const repScore     = Math.min(rawScore, 99);

    // Monthly volume for sparkline (last 6 months)
    const now = Date.now();
    const monthlyVol: number[] = Array(6).fill(0);
    myTrades.forEach(t => {
      const age = (now / 1000 - t.createdAt) / (30 * 86400);
      const bucket = Math.floor(age);
      if (bucket >= 0 && bucket < 6) monthlyVol[5 - bucket] += parseFloat(formatEth(t.amount));
    });

    return {
      total: myTrades.length, active: active.length,
      completed: completed.length, cancelled: cancelled.length,
      slashed: slashed.length, asBuyer: asBuyer.length, asSeller: asSeller.length,
      totalVol, completedVol, onTimeRate, penaltySeized, repScore, monthlyVol,
    };
  }, [trades, account]);

  // ── State distribution bar data ──────────────────────────────
  const stateDist = useMemo(() => {
    const counts: Partial<Record<TradeState, number>> = {};
    trades.forEach(t => { counts[t.state] = (counts[t.state] || 0) + 1; });
    return ([
      { label: 'Crtd', value: counts['Created']   || 0, color: '#9999ff' },
      { label: 'Fund', value: counts['Funded']     || 0, color: C.accent },
      { label: 'Trnst', value: counts['InTransit'] || 0, color: C.warn },
      { label: 'Dlvd', value: counts['Delivered']  || 0, color: '#00cc77' },
      { label: 'Done', value: counts['Completed']  || 0, color: C.mid },
      { label: 'Cncl', value: counts['Cancelled']  || 0, color: C.danger },
    ]);
  }, [trades]);

  // ── Filtered + sorted history ────────────────────────────────
  const history = useMemo(() => {
    let list = [...trades];
    if (filter === 'buyer')  list = list.filter(t => t.buyer.toLowerCase()  === account.toLowerCase());
    if (filter === 'seller') list = list.filter(t => t.seller.toLowerCase() === account.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.id.toLowerCase().includes(q) || t.buyer.toLowerCase().includes(q) || t.seller.toLowerCase().includes(q));
    }
    if (sort === 'amount') list.sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)));
    else list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }, [trades, filter, sort, search, account]);

  const accent = C.accent;

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono }}>
      {/* Grid overlay */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none', zIndex:0 }}/>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:`${C.bg}ee`, backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <button onClick={onBack} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'4px', color:C.mid, fontSize:'10px', letterSpacing:'0.12em', padding:'5px 12px', cursor:'pointer', fontFamily:C.mono, textTransform:'uppercase' as const }}>
            ← Ledger
          </button>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.accent, textTransform:'uppercase' as const }}>Iron Ledger · Screen 05</div>
            <div style={{ fontSize:'15px', fontFamily:C.serif, color:'#f2ede6', fontWeight:700, letterSpacing:'-0.01em', lineHeight:1.1 }}>The Vault</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <div style={{ textAlign:'right' as const }}>
            <div style={{ fontSize:'9px', color:C.dim, letterSpacing:'0.12em', textTransform:'uppercase' as const }}>Wallet</div>
            <div style={{ fontSize:'11px', color:C.mid }}>{shortenAddr(account)}</div>
          </div>
          <div style={{ width:'1px', height:'28px', background:C.border }}/>
          <div style={{ textAlign:'right' as const }}>
            <div style={{ fontSize:'9px', color:C.dim, letterSpacing:'0.12em', textTransform:'uppercase' as const }}>Rep Score</div>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.accent, fontFamily:C.serif }}>{stats.repScore}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ position:'relative', zIndex:1, maxWidth:'1100px', margin:'0 auto', padding:'28px 28px 80px' }}>

        {/* Top row: Seal + Key metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:'20px', marginBottom:'20px' }}>
          {/* Seal panel */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'28px 20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, alignSelf:'flex-start' }}>· Vault Seal</div>
            <IronSeal score={stats.repScore} />
            <div style={{ width:'100%', background:'rgba(255,255,255,0.03)', borderRadius:'4px', height:'4px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${stats.repScore}%`, background:C.accent, borderRadius:'4px', transition:'width 1s ease', boxShadow:`0 0 8px ${C.accent}50` }}/>
            </div>
            <div style={{ fontSize:'9px', color:C.dim, textAlign:'center' as const, lineHeight:1.6 }}>
              Score based on volume,<br/>on-time rate &amp; slash history
            </div>
          </div>

          {/* Metrics grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridTemplateRows:'1fr 1fr', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden' }}>
            {[
              { label:'Total Trades',    value: String(stats.total),                   color: C.text },
              { label:'Completed',       value: String(stats.completed),                color: C.accent },
              { label:'Active',          value: String(stats.active),                   color: stats.active > 0 ? C.warn : C.dim },
              { label:'Total Volume',    value: formatEth(stats.totalVol.toString())+' ETH', color: C.accent },
              { label:'On-Time Rate',    value: `${stats.onTimeRate}%`,                 color: stats.onTimeRate >= 90 ? C.accent : stats.onTimeRate >= 70 ? C.warn : C.danger },
              { label:'Penalty Seized',  value: formatEth(stats.penaltySeized.toString())+' ETH', color: stats.slashed > 0 ? C.danger : C.dim },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:C.bg, padding:'18px 20px' }}>
                <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'6px' }}>{label}</div>
                <div style={{ fontSize:'20px', fontWeight:700, fontFamily:C.serif, color, lineHeight:1.1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle row: Sparkline + Bar + Role split */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 180px 160px', gap:'20px', marginBottom:'20px' }}>
          {/* Volume sparkline */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' }}>· Volume (6-month)</div>
            <Sparkline points={stats.monthlyVol} color={C.accent} height={52}/>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'8px' }}>
              <span style={{ fontSize:'9px', color:C.dim }}>6mo ago</span>
              <span style={{ fontSize:'9px', color:C.dim }}>now</span>
            </div>
          </div>

          {/* State distribution */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' }}>· Trade States</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'5px', height:'60px' }}>
              {stateDist.map(({ label, value, color }) => {
                const max = Math.max(...stateDist.map(d => d.value), 1);
                return (
                  <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                    <div style={{ width:'100%', background:color, opacity:0.75, borderRadius:'2px 2px 0 0', height:`${(value/max)*48}px`, minHeight: value > 0 ? '3px' : '0', transition:'height 0.6s ease' }}/>
                    <div style={{ fontSize:'7px', color:C.dim, letterSpacing:'0.05em' }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buyer / Seller split */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' }}>· Role Split</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[
                { label:'As Buyer',  value:stats.asBuyer,  total:stats.total, color:C.blue },
                { label:'As Seller', value:stats.asSeller, total:stats.total, color:C.purple },
              ].map(({ label, value, total, color }) => (
                <div key={label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                    <span style={{ fontSize:'10px', color:C.dim }}>{label}</span>
                    <span style={{ fontSize:'10px', color, fontWeight:600 }}>{value}</span>
                  </div>
                  <div style={{ height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${total > 0 ? (value/total)*100 : 0}%`, background:color, borderRadius:'2px', transition:'width 0.8s ease' }}/>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'4px', paddingTop:'12px', borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'9px', color:C.dim }}>Slashed</span>
                  <span style={{ fontSize:'10px', color: stats.slashed > 0 ? C.danger : C.dim, fontWeight:600 }}>{stats.slashed}×</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trade history table */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', overflow:'hidden' }}>
          {/* Table header */}
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'2px' }}>· Trade History</div>
              <div style={{ fontSize:'11px', color:C.mid }}>{history.length} records</div>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              {/* Search */}
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search ID / address…"
                style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:'4px', padding:'6px 12px', fontSize:'11px', color:C.text, fontFamily:C.mono, outline:'none', width:'180px' }}
              />
              {/* Sort */}
              <select value={sort} onChange={e => setSort(e.target.value as any)}
                style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'6px 10px', fontSize:'10px', color:C.mid, fontFamily:C.mono, cursor:'pointer', letterSpacing:'0.08em' }}>
                <option value="date">Sort: Date</option>
                <option value="amount">Sort: Amount</option>
              </select>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 12px', display:'flex', gap:'4px' }}>
            <Tab label="All"    active={filter==='all'}    onClick={() => setFilter('all')} />
            <Tab label="Buyer"  active={filter==='buyer'}  onClick={() => setFilter('buyer')} />
            <Tab label="Seller" active={filter==='seller'} onClick={() => setFilter('seller')} />
          </div>

          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', gap:'0', padding:'10px 20px', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,0.015)' }}>
            {['Trade ID', 'Amount', 'Role', 'Counterparty', 'State', 'Penalty'].map(h => (
              <div key={h} style={{ fontSize:'8px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {history.length === 0 && (
            <div style={{ padding:'48px 20px', textAlign:'center' as const, color:C.dim, fontSize:'13px' }}>No records found</div>
          )}
          {history.map((t, i) => {
            const isBuyer = t.buyer.toLowerCase() === account.toLowerCase();
            const isSlash = t.sellerSlashed;
            return (
              <div key={t.id} style={{
                display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr',
                gap:'0', padding:'12px 20px',
                borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
                background: isSlash ? 'rgba(255,53,53,0.02)' : 'transparent',
                transition:'background 0.15s',
              }}>
                <div>
                  <div style={{ fontSize:'11px', color:C.mid, fontFamily:C.mono }}>{t.id.slice(0,10)}…{t.id.slice(-4)}</div>
                  {isSlash && <div style={{ fontSize:'9px', color:C.danger, letterSpacing:'0.08em', marginTop:'2px' }}>⚡ slashed</div>}
                </div>
                <div style={{ fontSize:'12px', color:C.accent, fontWeight:600 }}>{formatEth(t.amount)}</div>
                <div style={{ fontSize:'11px', color:C.text }}>{isBuyer ? '⬆ Buyer' : '⬇ Seller'}</div>
                <div style={{ fontSize:'11px', color:C.mid }}>{shortenAddr(isBuyer ? t.seller : t.buyer)}</div>
                <div><Badge state={t.state}/></div>
                <div style={{ fontSize:'11px', color: isSlash ? C.danger : C.mid }}>{t.slashingPenaltyBps/100}%</div>
              </div>
            );
          })}
        </div>

        {/* Bottom: Protocol stats strip */}
        <div style={{ marginTop:'20px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden' }}>
          {[
            { label:'Protocol',       value:'Iron Ledger v1' },
            { label:'Network',        value:'Sepolia / Local' },
            { label:'Slashing Bps',   value: trades.length > 0 ? `${trades[0].slashingPenaltyBps} bps` : '—' },
            { label:'Vault Version',  value:'v0.5.0' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background:C.bg, padding:'14px 18px' }}>
              <div style={{ fontSize:'8px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'4px' }}>{label}</div>
              <div style={{ fontSize:'12px', color:C.mid, fontFamily:C.mono }}>{value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}