'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../constants';

// ── Types ─────────────────────────────────────────────────────
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

interface GlobeNode {
  id: string;
  x: number;
  y: number;
  city: string;
  region: string;
  active: boolean;
  volume: number;
  trades: number;
}

const GLOBE_NODES: GlobeNode[] = [
  { id: 'nyc',  x: 215, y: 148, city: 'New York',    region: 'NA',  active: true,  volume: 48.2, trades: 142 },
  { id: 'lon',  x: 382, y: 118, city: 'London',      region: 'EU',  active: true,  volume: 61.7, trades: 198 },
  { id: 'dub',  x: 468, y: 148, city: 'Dubai',       region: 'ME',  active: true,  volume: 33.4, trades: 89  },
  { id: 'sin',  x: 598, y: 218, city: 'Singapore',   region: 'AS',  active: true,  volume: 55.1, trades: 167 },
  { id: 'tok',  x: 662, y: 138, city: 'Tokyo',       region: 'AS',  active: true,  volume: 29.8, trades: 94  },
  { id: 'mum',  x: 538, y: 188, city: 'Mumbai',      region: 'AS',  active: true,  volume: 22.3, trades: 71  },
  { id: 'fra',  x: 402, y: 128, city: 'Frankfurt',   region: 'EU',  active: false, volume: 18.9, trades: 58  },
  { id: 'syd',  x: 672, y: 298, city: 'Sydney',      region: 'OC',  active: true,  volume: 14.2, trades: 43  },
  { id: 'sao',  x: 258, y: 268, city: 'São Paulo',   region: 'SA',  active: false, volume: 9.7,  trades: 31  },
  { id: 'lag',  x: 398, y: 228, city: 'Lagos',       region: 'AF',  active: true,  volume: 7.1,  trades: 22  },
  { id: 'chi',  x: 198, y: 148, city: 'Chicago',     region: 'NA',  active: true,  volume: 19.4, trades: 61  },
  { id: 'zur',  x: 408, y: 122, city: 'Zurich',      region: 'EU',  active: true,  volume: 41.2, trades: 128 },
];

const ARCS = [
  ['nyc', 'lon'], ['lon', 'dub'], ['dub', 'sin'], ['sin', 'tok'],
  ['lon', 'fra'], ['sin', 'mum'], ['nyc', 'chi'], ['zur', 'lon'],
  ['sin', 'syd'], ['mum', 'dub'],
];

const FEED_TEMPLATES = [
  (n: GlobeNode) => `${n.city} → ${GLOBE_NODES[Math.floor(Math.random()*GLOBE_NODES.length)].city}: ${(Math.random()*10+0.1).toFixed(3)} ETH locked`,
  () => `Oracle: ETH/USD $${(3800 + Math.random()*200).toFixed(2)} (+${(Math.random()*0.5).toFixed(2)}%)`,
  (n: GlobeNode) => `Trade #${Math.floor(Math.random()*9000+1000)} SETTLED — ${n.city} node`,
  () => `Slashing protocol armed: ${Math.floor(Math.random()*5+1)} overdue`,
  (n: GlobeNode) => `New counterparty joined: ${n.city} operator`,
  () => `Gas: ${Math.floor(Math.random()*20+8)} gwei — ${Math.random()>0.5?'LOW':'NORMAL'}`,
  (n: GlobeNode) => `${n.city} escrow: ${(Math.random()*30+5).toFixed(2)} ETH in transit`,
];

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

function formatEth(wei: string) {
  return parseFloat(ethers.utils.formatEther(wei)).toFixed(3);
}
function shortenAddr(a: string) { return `${a.slice(0,6)}…${a.slice(-4)}`; }

function nodeRadius(volume: number) {
  return 3 + Math.sqrt(volume) * 0.8;
}

function WorldMap({
  nodes, activeNode, onNodeHover, pulseIds
}: {
  nodes: GlobeNode[];
  activeNode: string | null;
  onNodeHover: (id: string | null) => void;
  pulseIds: string[];
}) {
  return (
    <svg
      viewBox="0 0 800 380"
      style={{ width: '100%', height: '100%', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5">
        <path d="M80,80 L200,70 L230,90 L240,130 L220,160 L200,175 L170,170 L140,180 L120,200 L100,195 L85,175 L70,150 L65,120 Z" />
        <path d="M190,200 L240,195 L265,215 L270,250 L260,290 L240,310 L215,305 L200,280 L185,250 L180,220 Z" />
        <path d="M340,80 L420,75 L440,90 L435,115 L420,125 L400,120 L370,130 L350,120 L335,105 Z" />
        <path d="M350,140 L430,135 L445,165 L440,210 L420,245 L395,255 L370,245 L355,215 L345,180 Z" />
        <path d="M440,70 L680,65 L710,90 L700,130 L660,150 L600,155 L550,145 L500,150 L470,135 L450,110 Z" />
        <path d="M620,265 L700,260 L720,280 L715,310 L690,320 L655,315 L630,300 L615,285 Z" />
      </g>

      <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.5">
        {[0,1,2,3,4].map(i => (
          <line key={`h${i}`} x1="0" y1={i*95} x2="800" y2={i*95} />
        ))}
        {[0,1,2,3,4,5,6,7].map(i => (
          <line key={`v${i}`} x1={i*115} y1="0" x2={i*115} y2="380" />
        ))}
      </g>

      {ARCS.map(([fromId, toId], i) => {
        const from = nodes.find(n => n.id === fromId);
        const to   = nodes.find(n => n.id === toId);
        if (!from || !to) return null;
        const mx = (from.x + to.x) / 2;
        const my = Math.min(from.y, to.y) - 40;
        const isActive = activeNode === fromId || activeNode === toId;
        return (
          <path
            key={i}
            d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
            fill="none"
            stroke={isActive ? C.accent : 'rgba(184,255,0,0.12)'}
            strokeWidth={isActive ? 1.2 : 0.6}
            strokeDasharray={isActive ? 'none' : '3,4'}
            opacity={isActive ? 0.7 : 0.4}
            style={{ transition: 'all 0.3s' }}
          />
        );
      })}

      {nodes.map(node => {
        const r = nodeRadius(node.volume);
        const isHovered = activeNode === node.id;
        const isPulsing = pulseIds.includes(node.id);
        return (
          <g
            key={node.id}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onNodeHover(node.id)}
            onMouseLeave={() => onNodeHover(null)}
          >
            {(isPulsing || isHovered) && (
              <circle cx={node.x} cy={node.y} r={r + 6} fill="none"
                stroke={node.active ? C.accent : C.orange} strokeWidth="1" opacity="0.4"
                style={{ animation: 'mapPulse 1.5s ease-out infinite' }}
              />
            )}
            <circle cx={node.x} cy={node.y} r={r + 2}
              fill={node.active ? 'rgba(184,255,0,0.08)' : 'rgba(251,146,60,0.08)'}
              style={{ transition: 'all 0.3s' }}
            />
            <circle cx={node.x} cy={node.y} r={r}
              fill={node.active ? C.accent : C.orange}
              opacity={isHovered ? 1 : 0.75}
              style={{ transition: 'all 0.3s' }}
            />
            {(isHovered || node.volume > 40) && (
              <text x={node.x} y={node.y - r - 5} textAnchor="middle" fontSize="8"
                fill={node.active ? C.accent : C.orange} fontFamily={C.mono} opacity="0.9">
                {node.city}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FeedRow({ text, ts, fresh }: { text: string; ts: string; fresh: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: 12, padding: '7px 0', borderBottom: `1px solid ${C.border}`,
      animation: fresh ? 'feedSlide 0.35s ease' : 'none', opacity: fresh ? 1 : 0.65,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        <span style={{ color: C.dim, fontSize: 10, marginTop: 1, flexShrink: 0 }}>›</span>
        <span style={{ fontSize: 11, color: C.text, fontFamily: C.mono, lineHeight: 1.5, wordBreak: 'break-word' }}>{text}</span>
      </div>
      <span style={{ fontSize: 9, color: C.dim, fontFamily: C.mono, flexShrink: 0, paddingTop: 2 }}>{ts}</span>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const stateColor: Record<TradeState, string> = {
    Created: '#9999ff', Funded: C.accent, InTransit: C.orange,
    Delivered: '#00cc77', Completed: C.mid, Cancelled: C.danger,
  };
  const color = stateColor[trade.state];
  const nowSec = Math.floor(Date.now() / 1000);
  const overdue = trade.deadline < nowSec && !['Completed','Cancelled'].includes(trade.state);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 2, fontFamily: C.mono }}>{shortenAddr(trade.id)}</div>
        <div style={{ fontSize: 12, color: C.accent, fontFamily: C.mono, fontWeight: 600 }}>{formatEth(trade.amount)} ETH</div>
      </div>
      <span style={{ fontSize: 9, padding: '2px 7px', background: `${color}15`, border: `1px solid ${color}33`, borderRadius: 100, color, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: C.mono, textAlign: 'center' }}>
        {trade.state}
      </span>
      <div style={{ fontSize: 9, color: overdue ? C.danger : C.dim, fontFamily: C.mono, textAlign: 'right' }}>
        {overdue ? '⚡ OD' : new Date(trade.deadline * 1000).toLocaleDateString()}
      </div>
    </div>
  );
}

function RegionBar({ region, volume, max }: { region: string; volume: number; max: number }) {
  const pct = (volume / max) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: C.mono }}>{region}</span>
        <span style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, fontWeight: 600 }}>{volume.toFixed(1)} ETH</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent}, rgba(184,255,0,0.4))`, borderRadius: 2, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

interface GlobalCommandProps {
  account: string;
  trades: Trade[];
  onEnterLedger: () => void;
}

export default function GlobalCommand({ account, trades, onEnterLedger }: GlobalCommandProps) {
  const isMobile = useIsMobile();
  const [activeNode,  setActiveNode]  = useState<string | null>(null);
  const [pulseIds,    setPulseIds]    = useState<string[]>([]);
  const [feedItems,   setFeedItems]   = useState<{ text: string; ts: string; fresh: boolean }[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GlobeNode | null>(null);
  const [tab,         setTab]         = useState<'trades'|'nodes'|'feed'>('trades');

  useEffect(() => {
    const items = Array.from({ length: 6 }, (_, i) => {
      const node = GLOBE_NODES[i % GLOBE_NODES.length];
      const fn = FEED_TEMPLATES[i % FEED_TEMPLATES.length];
      return { text: fn(node), ts: `${String(i + 1).padStart(2,'0')}m ago`, fresh: false };
    });
    setFeedItems(items);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const node = GLOBE_NODES[Math.floor(Math.random() * GLOBE_NODES.length)];
      const fn   = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)];
      const text = fn(node);
      const now  = new Date();
      const ts   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      setFeedItems(prev => [{ text, ts, fresh: true }, ...prev.slice(0, 11)].map((item, i) => ({ ...item, fresh: i === 0 })));
      setPulseIds([node.id]);
      setTimeout(() => setPulseIds([]), 1500);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const handleNodeHover = useCallback((id: string | null) => {
    setActiveNode(id);
    setHoveredNode(id ? GLOBE_NODES.find(n => n.id === id) || null : null);
  }, []);

  const activeTrades  = trades.filter(t => !['Completed','Cancelled'].includes(t.state));
  const lockedWei     = activeTrades.filter(t => ['Funded','InTransit','Delivered'].includes(t.state))
    .reduce((a, t) => a + BigInt(t.amount), BigInt(0));
  const lockedEth     = parseFloat(ethers.utils.formatEther(lockedWei.toString())).toFixed(3);
  const nowSec        = Math.floor(Date.now() / 1000);
  const overdueCnt    = trades.filter(t => t.deadline < nowSec && ['Funded','InTransit'].includes(t.state)).length;
  const completedCnt  = trades.filter(t => t.state === 'Completed').length;

  const regionMap: Record<string, number> = {};
  GLOBE_NODES.forEach(n => { regionMap[n.region] = (regionMap[n.region] || 0) + n.volume; });
  const maxRegionVol = Math.max(...Object.values(regionMap));

  const regionLabels: Record<string, string> = {
    AS: 'Asia Pacific', EU: 'Europe', NA: 'North America',
    ME: 'Middle East', SA: 'South America', AF: 'Africa', OC: 'Oceania',
  };

  // Mobile: all-in-one stacked layout
  if (isMobile) {
    return (
      <>
        <style>{`
          @keyframes mapPulse { 0%{r:8;opacity:0.6} 100%{r:20;opacity:0} }
          @keyframes feedSlide { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
          @keyframes gcFadeIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
          .gc-tab{cursor:pointer;transition:all 0.15s}
        `}</style>
        <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, animation:'gcFadeIn 0.4s ease' }}>
          {/* Top bar */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid ${C.border}`, background:'rgba(0,0,0,0.3)', position:'sticky', top:0, zIndex:50 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:C.accent, boxShadow:`0 0 6px ${C.accent}` }} />
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:C.accent }}>IRON LEDGER</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {account && <span style={{ fontSize:10, color:C.dim }}>{shortenAddr(account)}</span>}
              <button onClick={onEnterLedger} style={{ padding:'7px 14px', background:'rgba(184,255,0,0.06)', border:`1px solid ${C.accent}44`, borderRadius:4, color:C.accent, fontSize:10, fontWeight:700, letterSpacing:'0.1em', cursor:'pointer', fontFamily:C.mono, textTransform:'uppercase' }}>
                ▶ Ledger
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:C.border, borderBottom:`1px solid ${C.border}` }}>
            {[
              { label:'Active',   value:String(activeTrades.length), accent:C.accent },
              { label:'Overdue',  value:String(overdueCnt),          accent:overdueCnt>0?C.danger:C.accent },
              { label:'Complete', value:String(completedCnt),        accent:'#00cc77' },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ background:C.bg, padding:'12px 8px', textAlign:'center' }}>
                <div style={{ fontSize:18, fontFamily:C.serif, fontWeight:700, color:accent, lineHeight:1, marginBottom:3 }}>{value}</div>
                <div style={{ fontSize:8, letterSpacing:'0.15em', color:C.dim, textTransform:'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Map — compact on mobile */}
          <div style={{ padding:'12px', background:C.bg, borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:8, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:8 }}>▸ GLOBAL NODE NETWORK</div>
            <div style={{ background:'rgba(0,0,0,0.3)', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', height:200 }}>
              <WorldMap nodes={GLOBE_NODES} activeNode={activeNode} onNodeHover={handleNodeHover} pulseIds={pulseIds} />
            </div>
          </div>

          {/* Mobile tabs: Trades / Feed */}
          <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:C.surface, position:'sticky', top:'45px', zIndex:40 }}>
            {(['trades','feed'] as const).map(t => (
              <div key={t} className="gc-tab" onClick={() => setTab(t)} style={{ flex:1, padding:'11px', textAlign:'center', fontSize:9, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:tab===t?C.accent:C.dim, borderBottom:tab===t?`2px solid ${C.accent}`:'2px solid transparent' }}>
                {t === 'trades' ? `Trades (${trades.length})` : 'Live Feed'}
              </div>
            ))}
          </div>

          <div style={{ padding:'12px 14px', minHeight:'300px' }}>
            {tab === 'trades' ? (
              trades.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 20px', color:C.dim, fontSize:12 }}>
                  No trades. <span onClick={onEnterLedger} style={{ color:C.accent, cursor:'pointer', textDecoration:'underline' }}>Enter Ledger →</span>
                </div>
              ) : trades.map(t => <TradeRow key={t.id} trade={t} />)
            ) : (
              feedItems.map((item, i) => <FeedRow key={i} text={item.text} ts={item.ts} fresh={item.fresh} />)
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop layout (unchanged)
  return (
    <>
      <style>{`
        @keyframes mapPulse { 0%{r:8;opacity:0.6} 100%{r:20;opacity:0} }
        @keyframes feedSlide { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        @keyframes gcFadeIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .gc-tab{cursor:pointer;transition:all 0.15s}
        .gc-tab:hover{color:rgba(255,255,255,0.7)!important}
        .gc-node-row{transition:background 0.15s}
        .gc-node-row:hover{background:rgba(184,255,0,0.04)!important}
        .gc-btn:hover{background:rgba(184,255,0,0.12)!important}
        .gc-btn:active{transform:scale(0.98)}
      `}</style>

      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:C.mono, display:'flex', flexDirection:'column', animation:'gcFadeIn 0.4s ease' }}>
        {/* Top Bar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderBottom:`1px solid ${C.border}`, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(8px)', position:'sticky', top:0, zIndex:50, flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:C.accent, boxShadow:`0 0 8px ${C.accent}` }} />
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.15em', color:C.accent }}>IRON LEDGER // SETTLEMENT DASHBOARD</span>
            </div>
            <span style={{ fontSize:9, color:C.dim, letterSpacing:'0.1em' }}>SCREEN 02 — SETTLEMENT DASHBOARD</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:10, color:C.dim, fontFamily:C.mono }}>{account ? `OP: ${shortenAddr(account)}` : 'NOT CONNECTED'}</span>
            <button className="gc-btn" onClick={onEnterLedger} style={{ padding:'6px 16px', background:'rgba(184,255,0,0.06)', border:`1px solid ${C.accent}44`, borderRadius:4, color:C.accent, fontSize:10, fontWeight:700, letterSpacing:'0.12em', cursor:'pointer', fontFamily:C.mono, textTransform:'uppercase' }}>
              ▶ Enter Dashboard
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:1, background:C.border, borderBottom:`1px solid ${C.border}` }}>
          {[
            { label:'Active Trades',   value:String(activeTrades.length),  accent:C.accent  },
            { label:'ETH In Escrow',   value:lockedEth,                    accent:C.blue    },
            { label:'Overdue',         value:String(overdueCnt),           accent:overdueCnt>0?C.danger:C.accent },
            { label:'Completed',       value:String(completedCnt),         accent:'#00cc77' },
            { label:'Global Nodes',    value:String(GLOBE_NODES.filter(n=>n.active).length), accent:C.purple },
            { label:'Total Volume',    value:`${GLOBE_NODES.reduce((a,n)=>a+n.volume,0).toFixed(0)} ETH`, accent:C.orange },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ background:C.bg, padding:'14px 18px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontFamily:C.serif, fontWeight:700, color:accent, lineHeight:1, marginBottom:4 }}>{value}</div>
              <div style={{ fontSize:9, letterSpacing:'0.18em', color:C.dim, textTransform:'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 320px', gap:0, minHeight:0 }}>
          {/* Left: Map + Region bars */}
          <div style={{ display:'flex', flexDirection:'column', borderRight:`1px solid ${C.border}` }}>
            <div style={{ flex:1, padding:'16px', position:'relative', minHeight:300 }}>
              <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>▸ GLOBAL NODE NETWORK</span>
                <div style={{ display:'flex', gap:14, fontSize:9 }}>
                  <span><span style={{ color:C.accent }}>●</span> Active</span>
                  <span><span style={{ color:C.orange }}>●</span> Standby</span>
                </div>
              </div>
              <div style={{ background:'rgba(0,0,0,0.3)', border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', height:320 }}>
                <WorldMap nodes={GLOBE_NODES} activeNode={activeNode} onNodeHover={handleNodeHover} pulseIds={pulseIds} />
              </div>
              {hoveredNode && (
                <div style={{ position:'absolute', bottom:24, left:24, background:C.panel, border:`1px solid ${C.accent}44`, borderRadius:6, padding:'10px 14px', fontSize:11, pointerEvents:'none', zIndex:10 }}>
                  <div style={{ color:C.accent, fontWeight:700, marginBottom:4, letterSpacing:'0.1em' }}>{hoveredNode.city}</div>
                  <div style={{ color:C.dim, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 16px', fontSize:10 }}>
                    <span>Volume</span><span style={{ color:C.text }}>{hoveredNode.volume} ETH</span>
                    <span>Trades</span><span style={{ color:C.text }}>{hoveredNode.trades}</span>
                    <span>Status</span><span style={{ color:hoveredNode.active?C.accent:C.orange }}>{hoveredNode.active?'ONLINE':'STANDBY'}</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding:'14px 18px', borderTop:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontSize:9, letterSpacing:'0.2em', color:C.dim, textTransform:'uppercase', marginBottom:12 }}>▸ VOLUME BY REGION</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 24px' }}>
                {Object.entries(regionMap).sort(([,a],[,b])=>b-a).map(([region,volume])=>(
                  <RegionBar key={region} region={regionLabels[region]||region} volume={volume} max={maxRegionVol} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Tabs + Feed */}
          <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:C.surface }}>
              {(['trades','nodes'] as const).map(t => (
                <div key={t} className="gc-tab" onClick={() => setTab(t)} style={{ flex:1, padding:'12px', textAlign:'center', fontSize:9, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:tab===t?C.accent:C.dim, borderBottom:tab===t?`2px solid ${C.accent}`:'2px solid transparent', transition:'all 0.15s' }}>
                  {t === 'trades' ? `My Trades (${trades.length})` : `Nodes (${GLOBE_NODES.length})`}
                </div>
              ))}
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', scrollbarWidth:'thin', scrollbarColor:'#1e293b transparent' }}>
              {tab === 'trades' ? (
                trades.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:C.dim, fontSize:12 }}>
                    No trades found.<br /><span onClick={onEnterLedger} style={{ color:C.accent, cursor:'pointer', textDecoration:'underline', fontSize:11 }}>Open Contract Drafting to create one ↗</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:9, color:C.dim, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>▸ YOUR POSITIONS</div>
                    {trades.map(t => <TradeRow key={t.id} trade={t} />)}
                  </>
                )
              ) : (
                <>
                  <div style={{ fontSize:9, color:C.dim, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>▸ SETTLEMENT NODES</div>
                  {GLOBE_NODES.sort((a,b)=>b.volume-a.volume).map(node=>(
                    <div key={node.id} className="gc-node-row" onMouseEnter={()=>handleNodeHover(node.id)} onMouseLeave={()=>handleNodeHover(null)} style={{ display:'grid', gridTemplateColumns:'1fr 60px 50px', gap:8, padding:'8px 6px', borderBottom:`1px solid ${C.border}`, alignItems:'center', borderRadius:4 }}>
                      <div>
                        <div style={{ fontSize:11, color:C.text, marginBottom:2 }}>{node.city}</div>
                        <div style={{ fontSize:9, color:C.dim }}>{regionLabels[node.region]}</div>
                      </div>
                      <div style={{ fontSize:10, color:C.accent, fontFamily:C.mono, textAlign:'right' }}>{node.volume.toFixed(1)} ETH</div>
                      <div style={{ fontSize:9, color:node.active?C.accent:C.orange, textAlign:'right', fontWeight:700, letterSpacing:'0.08em' }}>{node.active?'LIVE':'STBY'}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Live feed */}
            <div style={{ borderTop:`1px solid ${C.border}`, background:C.surface, height:260, display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:9, color:C.dim, letterSpacing:'0.2em', textTransform:'uppercase' }}>▸ LIVE FEED</span>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:C.accent, animation:'mapPulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize:9, color:C.accent }}>LIVE</span>
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'4px 16px', scrollbarWidth:'thin', scrollbarColor:'#1e293b transparent' }}>
                {feedItems.map((item,i) => <FeedRow key={i} text={item.text} ts={item.ts} fresh={item.fresh} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}