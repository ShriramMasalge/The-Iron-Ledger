'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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

// ── CSV Export ────────────────────────────────────────────────
function exportCSV(trades: Trade[], account: string) {
  const headers = ['Trade ID','Role','Counterparty','Buyer','Seller','Amount (ETH)','State','Penalty (bps)','Penalty (%)','Slashed','Created At','Deadline','Deadline UTC'];
  const rows = trades.map(t => {
    const isBuyer     = t.buyer.toLowerCase() === account.toLowerCase();
    const counterparty = isBuyer ? t.seller : t.buyer;
    const amountEth   = formatEth(t.amount);
    const createdStr  = new Date(t.createdAt*1000).toISOString().replace('T',' ').slice(0,19);
    const deadlineStr = new Date(t.deadline*1000).toISOString().replace('T',' ').slice(0,19);
    return [t.id, isBuyer?'Buyer':'Seller', counterparty, t.buyer, t.seller, amountEth, t.state, t.slashingPenaltyBps, (t.slashingPenaltyBps/100).toFixed(2)+'%', t.sellerSlashed?'Yes':'No', createdStr, t.deadline, deadlineStr];
  });
  const csv = [headers,...rows].map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`iron-ledger-trades-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ onClick, count }: { onClick: () => void; count: number }) {
  const [flash, setFlash] = useState(false);
  const handleClick = () => { onClick(); setFlash(true); setTimeout(()=>setFlash(false),1200); };
  return (
    <button onClick={handleClick} disabled={count===0}
      style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', background:flash?'rgba(184,255,0,0.12)':'rgba(184,255,0,0.05)', border:`1px solid ${flash?'rgba(184,255,0,0.5)':'rgba(184,255,0,0.2)'}`, borderRadius:'4px', color:flash?C.accent:'rgba(184,255,0,0.6)', fontSize:'10px', fontFamily:C.mono, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', cursor:count===0?'not-allowed':'pointer', opacity:count===0?0.35:1, transition:'all 0.2s', whiteSpace:'nowrap', minHeight:'36px' }}>
      {flash?'✓ Exported':'↓ CSV'}
      {!flash&&<span style={{ fontSize:'9px', color:'rgba(184,255,0,0.4)', fontWeight:400 }}>{count}</span>}
    </button>
  );
}

function IronSeal({ score }: { score: number }) {
  const tier = score>=90?'IRON':score>=70?'BRONZE':score>=50?'SILVER':'UNRANKED';
  const tierColor = score>=90?C.accent:score>=70?'#cd7f32':score>=50?'#c0c0c0':C.dim;
  const rings=[44,36,28], pct=score/100;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <defs>
          <filter id="sealGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {rings.map((r,i)=>(<circle key={i} cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"/>))}
        <circle cx="60" cy="60" r={44} fill="none" stroke={tierColor} strokeWidth="2.5" opacity="0.3"
          strokeDasharray={`${pct*2*Math.PI*44} ${2*Math.PI*44}`} strokeLinecap="round" transform="rotate(-90 60 60)"
          style={{ filter:`drop-shadow(0 0 4px ${tierColor})` }}/>
        <circle cx="60" cy="60" r={28} fill="none" stroke={tierColor} strokeWidth="1.5" opacity="0.5"
          strokeDasharray={`${pct*2*Math.PI*28} ${2*Math.PI*28}`} strokeLinecap="round" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="18" fill={`${tierColor}10`} stroke={`${tierColor}30`} strokeWidth="1"/>
        <text x="60" y="65" textAnchor="middle" fontSize="18" fill={tierColor} style={{fontFamily:'serif'}}>⚖</text>
        {[0,90,180,270].map(deg=>{
          const angle=(deg-90)*Math.PI/180, x=60+44*Math.cos(angle), y=60+44*Math.sin(angle);
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

function Sparkline({ points, color=C.accent, height=40 }: { points: number[]; color?: string; height?: number }) {
  if (points.length<2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:C.dim }}>No data</div>;
  const w=200, h=height, min=Math.min(...points), max=Math.max(...points), range=max-min||1;
  const step=w/(points.length-1);
  const toY=(v:number)=>h-((v-min)/range)*(h-6)-3;
  const d=points.map((v,i)=>`${i===0?'M':'L'} ${i*step} ${toY(v)}`).join(' ');
  const fill=points.map((v,i)=>`${i===0?'M':'L'} ${i*step} ${toY(v)}`).join(' ')+` L ${(points.length-1)*step} ${h} L 0 ${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={fill} fill="url(#sparkFill)"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(points.length-1)*step} cy={toY(points[points.length-1])} r="2.5" fill={color}/>
    </svg>
  );
}

function Badge({ state }: { state: TradeState }) {
  const map: Record<TradeState,[string,string]> = {
    Created:   ['rgba(120,120,255,0.1)','#9999ff'],
    Funded:    ['rgba(184,255,0,0.07)',C.accent],
    InTransit: ['rgba(255,165,0,0.1)','#ffaa00'],
    Delivered: ['rgba(0,200,100,0.1)','#00cc77'],
    Completed: ['rgba(255,255,255,0.04)','rgba(255,255,255,0.3)'],
    Cancelled: ['rgba(255,53,53,0.07)','#ff6666'],
  };
  const [bg, color] = map[state];
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', background:bg, color, border:`1px solid ${color}33`, borderRadius:'100px', fontSize:'9px', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' as const, fontFamily:C.mono }}>{state}</span>;
}

function Tab({ label, active, onClick }: { label:string; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ background:'none', border:'none', padding:'8px 14px', fontSize:'10px', letterSpacing:'0.14em', textTransform:'uppercase' as const, fontFamily:C.mono, color:active?C.accent:C.dim, borderBottom:active?`1px solid ${C.accent}`:'1px solid transparent', cursor:'pointer', transition:'all 0.15s', minHeight:'40px' }}>
      {label}
    </button>
  );
}

// ── Mobile section accordion ──────────────────────────────────
function MobileSection({ title, children, defaultOpen=false }: { title:string; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', marginBottom:'12px', overflow:'hidden' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none' }}>
        <span style={{ fontSize:'10px', fontWeight:600, letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' }}>{title}</span>
        <span style={{ fontSize:'12px', color:C.dim, transition:'transform 0.2s', transform:open?'rotate(90deg)':'none' }}>›</span>
      </div>
      {open && <div style={{ padding:'0 16px 16px' }}>{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN VAULT COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function TheVault({ account, trades, onBack }: TheVaultProps) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<'all'|'buyer'|'seller'>('all');
  const [sort,   setSort]   = useState<'date'|'amount'>('date');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const completed  = trades.filter(t=>t.state==='Completed');
    const slashed    = trades.filter(t=>t.sellerSlashed);
    const asBuyer    = trades.filter(t=>t.buyer.toLowerCase()===account.toLowerCase());
    const asSeller   = trades.filter(t=>t.seller.toLowerCase()===account.toLowerCase());
    const active     = trades.filter(t=>!['Completed','Cancelled'].includes(t.state));
    const totalVol   = trades.reduce((a,t)=>a+BigInt(t.amount),BigInt(0));
    const onTimeCompleted = completed.filter(t=>!t.sellerSlashed).length;
    const onTimeRate = completed.length>0?Math.round((onTimeCompleted/completed.length)*100):100;
    const penaltySeized = slashed.reduce((a,t)=>{ const p=BigInt(t.amount)*BigInt(t.slashingPenaltyBps)/BigInt(10000); return a+p; },BigInt(0));
    const volScore    = Math.min(parseFloat(formatEth(totalVol.toString()))*20,30);
    const onTimeScore = onTimeRate*0.4;
    const countScore  = Math.min(completed.length*3,20);
    const slashPenalty= slashed.length*5;
    const repScore    = Math.min(Math.max(0,Math.round(volScore+onTimeScore+countScore-slashPenalty)),99);
    const now = Date.now();
    const monthlyVol: number[] = Array(6).fill(0);
    trades.forEach(t=>{ const age=(now/1000-t.createdAt)/(30*86400); const bucket=Math.floor(age); if(bucket>=0&&bucket<6) monthlyVol[5-bucket]+=parseFloat(formatEth(t.amount)); });
    return { total:trades.length, active:active.length, completed:completed.length, cancelled:trades.filter(t=>t.state==='Cancelled').length, slashed:slashed.length, asBuyer:asBuyer.length, asSeller:asSeller.length, totalVol, onTimeRate, penaltySeized, repScore, monthlyVol };
  }, [trades, account]);

  const stateDist = useMemo(() => {
    const counts: Partial<Record<TradeState,number>> = {};
    trades.forEach(t=>{ counts[t.state]=(counts[t.state]||0)+1; });
    return ([
      { label:'Crtd',  value:counts['Created']   ||0, color:'#9999ff' },
      { label:'Fund',  value:counts['Funded']     ||0, color:C.accent },
      { label:'Trnst', value:counts['InTransit']  ||0, color:C.warn },
      { label:'Dlvd',  value:counts['Delivered']  ||0, color:'#00cc77' },
      { label:'Done',  value:counts['Completed']  ||0, color:C.mid },
      { label:'Cncl',  value:counts['Cancelled']  ||0, color:C.danger },
    ]);
  }, [trades]);

  const history = useMemo(() => {
    let list = [...trades];
    if (filter==='buyer')  list=list.filter(t=>t.buyer.toLowerCase()===account.toLowerCase());
    if (filter==='seller') list=list.filter(t=>t.seller.toLowerCase()===account.toLowerCase());
    if (search) {
      const q=search.toLowerCase();
      list=list.filter(t=>t.id.toLowerCase().includes(q)||t.buyer.toLowerCase().includes(q)||t.seller.toLowerCase().includes(q));
    }
    if (sort==='amount') list.sort((a,b)=>Number(BigInt(b.amount)-BigInt(a.amount)));
    else list.sort((a,b)=>b.createdAt-a.createdAt);
    return list;
  }, [trades,filter,sort,search,account]);

  const handleExport = useCallback(()=>{ exportCSV(history,account); },[history,account]);

  // ── MOBILE LAYOUT ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono }}>
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none', zIndex:0 }}/>

        {/* Header */}
        <div style={{ position:'sticky', top:0, zIndex:20, background:`${C.bg}ee`, backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.border}`, padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={onBack} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'4px', color:C.mid, fontSize:'10px', letterSpacing:'0.12em', padding:'6px 10px', cursor:'pointer', fontFamily:C.mono, textTransform:'uppercase' as const, minHeight:'34px' }}>← Back</button>
            <div>
              <div style={{ fontSize:'8px', letterSpacing:'0.18em', color:C.accent, textTransform:'uppercase' as const }}>Iron Ledger</div>
              <div style={{ fontSize:'15px', fontFamily:C.serif, color:'#f2ede6', fontWeight:700, lineHeight:1.1 }}>Performance Analytics</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ textAlign:'right' as const }}>
              <div style={{ fontSize:'8px', color:C.dim, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>Rep</div>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.accent, fontFamily:C.serif, lineHeight:1 }}>{stats.repScore}</div>
            </div>
          </div>
        </div>

        <div style={{ position:'relative', zIndex:1, padding:'16px 14px 80px' }}>

          {/* Seal + key stats */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px 16px', marginBottom:'12px', display:'flex', gap:'16px', alignItems:'center' }}>
            <IronSeal score={stats.repScore} />
            <div style={{ flex:1 }}>
              <div style={{ width:'100%', background:'rgba(255,255,255,0.03)', borderRadius:'4px', height:'3px', overflow:'hidden', marginBottom:'12px' }}>
                <div style={{ height:'100%', width:`${stats.repScore}%`, background:C.accent, borderRadius:'4px', boxShadow:`0 0 8px ${C.accent}50` }}/>
              </div>
              {[
                { label:'Total Trades',  value:String(stats.total),                         color:C.text   },
                { label:'Completed',     value:String(stats.completed),                     color:C.accent },
                { label:'On-Time Rate',  value:`${stats.onTimeRate}%`,                      color:stats.onTimeRate>=90?C.accent:stats.onTimeRate>=70?C.warn:C.danger },
                { label:'Total Volume',  value:formatEth(stats.totalVol.toString())+' ETH', color:C.accent },
              ].map(({label,value,color})=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:'9px', letterSpacing:'0.12em', color:C.dim, textTransform:'uppercase' as const }}>{label}</span>
                  <span style={{ fontSize:'11px', fontWeight:700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Charts — accordion */}
          <MobileSection title="Volume & Charts">
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'10px' }}>6-Month Volume</div>
              <Sparkline points={stats.monthlyVol} color={C.accent} height={48}/>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
                <span style={{ fontSize:'9px', color:C.dim }}>6mo ago</span>
                <span style={{ fontSize:'9px', color:C.dim }}>now</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'10px' }}>Trade States</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:'5px', height:'48px' }}>
                {stateDist.map(({ label, value, color }) => {
                  const max = Math.max(...stateDist.map(d=>d.value),1);
                  return (
                    <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                      <div style={{ width:'100%', background:color, opacity:0.75, borderRadius:'2px 2px 0 0', height:`${(value/max)*42}px`, minHeight:value>0?'3px':'0', transition:'height 0.6s ease' }}/>
                      <div style={{ fontSize:'7px', color:C.dim }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop:'16px' }}>
              <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'10px' }}>Role Split</div>
              {[
                { label:'As Buyer',  value:stats.asBuyer,  total:stats.total, color:C.blue },
                { label:'As Seller', value:stats.asSeller, total:stats.total, color:C.purple },
              ].map(({label,value,total,color})=>(
                <div key={label} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontSize:'10px', color:C.dim }}>{label}</span>
                    <span style={{ fontSize:'10px', color, fontWeight:600 }}>{value}</span>
                  </div>
                  <div style={{ height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${total>0?(value/total)*100:0}%`, background:color, borderRadius:'2px', transition:'width 0.8s ease' }}/>
                  </div>
                </div>
              ))}
            </div>
          </MobileSection>

          {/* Trade history */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', overflow:'hidden', marginBottom:'12px' }}>
            <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const }}>Trade History ({history.length})</div>
                <ExportButton onClick={handleExport} count={history.length} />
              </div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ID / address…"
                style={{ width:'100%', background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:'4px', padding:'8px 12px', fontSize:'13px', color:C.text, fontFamily:C.mono, outline:'none', boxSizing:'border-box' as const }}/>
            </div>

            {/* Filter + sort row */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${C.border}`, padding:'0 8px' }}>
              <div style={{ display:'flex' }}>
                <Tab label="All"    active={filter==='all'}    onClick={()=>setFilter('all')} />
                <Tab label="Buyer"  active={filter==='buyer'}  onClick={()=>setFilter('buyer')} />
                <Tab label="Seller" active={filter==='seller'} onClick={()=>setFilter('seller')} />
              </div>
              <select value={sort} onChange={e=>setSort(e.target.value as any)}
                style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'5px 8px', fontSize:'10px', color:C.mid, fontFamily:C.mono, cursor:'pointer' }}>
                <option value="date">Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>

            {/* Mobile trade rows — compact cards */}
            {history.length===0 && <div style={{ padding:'40px 20px', textAlign:'center' as const, color:C.dim, fontSize:'13px' }}>No records found</div>}
            {history.map((t,i)=>{
              const isBuyer = t.buyer.toLowerCase()===account.toLowerCase();
              const isSlash = t.sellerSlashed;
              return (
                <div key={t.id} style={{ padding:'12px 16px', borderBottom:i<history.length-1?`1px solid ${C.border}`:'none', background:isSlash?'rgba(255,53,53,0.02)':'transparent' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                    <div>
                      <div style={{ fontSize:'10px', color:C.mid, fontFamily:C.mono }}>{t.id.slice(0,10)}…{t.id.slice(-4)}</div>
                      <div style={{ fontSize:'15px', color:C.accent, fontWeight:600, marginTop:'2px' }}>{formatEth(t.amount)} ETH</div>
                    </div>
                    <Badge state={t.state}/>
                  </div>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <span style={{ fontSize:'10px', color:C.text }}>{isBuyer?'⬆ Buyer':'⬇ Seller'}</span>
                    <span style={{ fontSize:'10px', color:C.mid }}>{shortenAddr(isBuyer?t.seller:t.buyer)}</span>
                    <span style={{ fontSize:'10px', color:isSlash?C.danger:C.mid }}>{t.slashingPenaltyBps/100}%</span>
                    {isSlash&&<span style={{ fontSize:'9px', color:C.danger }}>⚡ slashed</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Protocol strip */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden' }}>
            {[
              { label:'Protocol',     value:'Iron Ledger v1' },
              { label:'Network',      value:'Sepolia / Local' },
              { label:'Vault Ver.',   value:'v0.5.1' },
              { label:'Penalty Bps',  value:trades.length>0?`${trades[0].slashingPenaltyBps} bps`:'—' },
            ].map(({label,value})=>(
              <div key={label} style={{ background:C.bg, padding:'12px 14px' }}>
                <div style={{ fontSize:'8px', letterSpacing:'0.15em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'3px' }}>{label}</div>
                <div style={{ fontSize:'11px', color:C.mid, fontFamily:C.mono }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT (unchanged) ────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono }}>
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none', zIndex:0 }}/>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:20, background:`${C.bg}ee`, backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <button onClick={onBack} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'4px', color:C.mid, fontSize:'10px', letterSpacing:'0.12em', padding:'5px 12px', cursor:'pointer', fontFamily:C.mono, textTransform:'uppercase' as const }}>← Ledger</button>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.accent, textTransform:'uppercase' as const }}>Iron Ledger · Screen 05</div>
            <div style={{ fontSize:'15px', fontFamily:C.serif, color:'#f2ede6', fontWeight:700, letterSpacing:'-0.01em', lineHeight:1.1 }}>Performance Analytics</div>
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
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'28px 20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, alignSelf:'flex-start' }}>· Reputation Seal</div>
            <IronSeal score={stats.repScore} />
            <div style={{ width:'100%', background:'rgba(255,255,255,0.03)', borderRadius:'4px', height:'4px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${stats.repScore}%`, background:C.accent, borderRadius:'4px', transition:'width 1s ease', boxShadow:`0 0 8px ${C.accent}50` }}/>
            </div>
            <div style={{ fontSize:'9px', color:C.dim, textAlign:'center' as const, lineHeight:1.6 }}>Score based on volume,<br/>on-time rate &amp; slash history</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridTemplateRows:'1fr 1fr', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden' }}>
            {[
              { label:'Total Trades',   value:String(stats.total),                             color:C.text },
              { label:'Completed',      value:String(stats.completed),                          color:C.accent },
              { label:'Active',         value:String(stats.active),                             color:stats.active>0?C.warn:C.dim },
              { label:'Total Volume',   value:formatEth(stats.totalVol.toString())+' ETH',      color:C.accent },
              { label:'On-Time Rate',   value:`${stats.onTimeRate}%`,                           color:stats.onTimeRate>=90?C.accent:stats.onTimeRate>=70?C.warn:C.danger },
              { label:'Penalty Seized', value:formatEth(stats.penaltySeized.toString())+' ETH', color:stats.slashed>0?C.danger:C.dim },
            ].map(({label,value,color})=>(
              <div key={label} style={{ background:C.bg, padding:'18px 20px' }}>
                <div style={{ fontSize:'9px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'6px' }}>{label}</div>
                <div style={{ fontSize:'20px', fontWeight:700, fontFamily:C.serif, color, lineHeight:1.1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle row: Sparkline + Bar + Role split */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 180px 160px', gap:'20px', marginBottom:'20px' }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' }}>· Volume (6-month)</div>
            <Sparkline points={stats.monthlyVol} color={C.accent} height={52}/>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'8px' }}>
              <span style={{ fontSize:'9px', color:C.dim }}>6mo ago</span>
              <span style={{ fontSize:'9px', color:C.dim }}>now</span>
            </div>
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' }}>· Trade States</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'5px', height:'60px' }}>
              {stateDist.map(({label,value,color})=>{
                const max=Math.max(...stateDist.map(d=>d.value),1);
                return (
                  <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                    <div style={{ width:'100%', background:color, opacity:0.75, borderRadius:'2px 2px 0 0', height:`${(value/max)*48}px`, minHeight:value>0?'3px':'0', transition:'height 0.6s ease' }}/>
                    <div style={{ fontSize:'7px', color:C.dim, letterSpacing:'0.05em' }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'20px' }}>
            <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'14px' }}>· Role Split</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[
                { label:'As Buyer',  value:stats.asBuyer,  total:stats.total, color:C.blue },
                { label:'As Seller', value:stats.asSeller, total:stats.total, color:C.purple },
              ].map(({label,value,total,color})=>(
                <div key={label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                    <span style={{ fontSize:'10px', color:C.dim }}>{label}</span>
                    <span style={{ fontSize:'10px', color, fontWeight:600 }}>{value}</span>
                  </div>
                  <div style={{ height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${total>0?(value/total)*100:0}%`, background:color, borderRadius:'2px', transition:'width 0.8s ease' }}/>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'4px', paddingTop:'12px', borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'9px', color:C.dim }}>Slashed</span>
                  <span style={{ fontSize:'10px', color:stats.slashed>0?C.danger:C.dim, fontWeight:600 }}>{stats.slashed}×</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trade history table */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <div style={{ fontSize:'9px', letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase' as const, marginBottom:'2px' }}>· Trade History</div>
              <div style={{ fontSize:'11px', color:C.mid }}>{history.length} records</div>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ID / address…"
                style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:'4px', padding:'6px 12px', fontSize:'11px', color:C.text, fontFamily:C.mono, outline:'none', width:'180px' }}/>
              <select value={sort} onChange={e=>setSort(e.target.value as any)}
                style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'6px 10px', fontSize:'10px', color:C.mid, fontFamily:C.mono, cursor:'pointer', letterSpacing:'0.08em' }}>
                <option value="date">Sort: Date</option>
                <option value="amount">Sort: Amount</option>
              </select>
              <ExportButton onClick={handleExport} count={history.length} />
            </div>
          </div>

          <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 12px', display:'flex', gap:'4px' }}>
            <Tab label="All"    active={filter==='all'}    onClick={()=>setFilter('all')} />
            <Tab label="Buyer"  active={filter==='buyer'}  onClick={()=>setFilter('buyer')} />
            <Tab label="Seller" active={filter==='seller'} onClick={()=>setFilter('seller')} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', gap:'0', padding:'10px 20px', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,0.015)' }}>
            {['Trade ID','Amount','Role','Counterparty','State','Penalty'].map(h=>(
              <div key={h} style={{ fontSize:'8px', letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' as const }}>{h}</div>
            ))}
          </div>

          {history.length===0&&<div style={{ padding:'48px 20px', textAlign:'center' as const, color:C.dim, fontSize:'13px' }}>No records found</div>}
          {history.map((t,i)=>{
            const isBuyer = t.buyer.toLowerCase()===account.toLowerCase();
            const isSlash = t.sellerSlashed;
            return (
              <div key={t.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', gap:'0', padding:'12px 20px', borderBottom:i<history.length-1?`1px solid ${C.border}`:'none', background:isSlash?'rgba(255,53,53,0.02)':'transparent', transition:'background 0.15s' }}>
                <div>
                  <div style={{ fontSize:'11px', color:C.mid, fontFamily:C.mono }}>{t.id.slice(0,10)}…{t.id.slice(-4)}</div>
                  {isSlash&&<div style={{ fontSize:'9px', color:C.danger, letterSpacing:'0.08em', marginTop:'2px' }}>⚡ slashed</div>}
                </div>
                <div style={{ fontSize:'12px', color:C.accent, fontWeight:600 }}>{formatEth(t.amount)}</div>
                <div style={{ fontSize:'11px', color:C.text }}>{isBuyer?'⬆ Buyer':'⬇ Seller'}</div>
                <div style={{ fontSize:'11px', color:C.mid }}>{shortenAddr(isBuyer?t.seller:t.buyer)}</div>
                <div><Badge state={t.state}/></div>
                <div style={{ fontSize:'11px', color:isSlash?C.danger:C.mid }}>{t.slashingPenaltyBps/100}%</div>
              </div>
            );
          })}
        </div>

        {/* Protocol stats strip */}
        <div style={{ marginTop:'20px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:C.border, borderRadius:'8px', overflow:'hidden' }}>
          {[
            { label:'Protocol',     value:'Iron Ledger v1' },
            { label:'Network',      value:'Sepolia / Local' },
            { label:'Slashing Bps', value:trades.length>0?`${trades[0].slashingPenaltyBps} bps`:'—' },
            { label:'System Version',value:'v0.5.1' },
          ].map(({label,value})=>(
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