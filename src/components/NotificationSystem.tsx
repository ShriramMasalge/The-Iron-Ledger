'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';

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

export interface ILNotification {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  title: string;
  body: string;
  tradeId?: string;
  ts: number;
  read: boolean;
}

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:      '#080909',
  surface: '#0f1011',
  panel:   '#13151a',
  border:  'rgba(255,255,255,0.06)',
  accent:  '#b8ff00',
  danger:  '#ff3535',
  warn:    '#ffaa00',
  blue:    '#38bdf8',
  text:    '#ddd9d0',
  mid:     'rgba(255,255,255,0.4)',
  dim:     'rgba(255,255,255,0.18)',
  mono:    "'DM Mono','Courier New',monospace",
  serif:   "'DM Serif Display',Georgia,serif",
};

function formatEth(wei: string) {
  return parseFloat(ethers.utils.formatEther(wei)).toFixed(4);
}
function shortenId(id: string) { return `${id.slice(0, 8)}…`; }

// ── Notification thresholds ───────────────────────────────────
// We fire at: 1h, 15m, 5m, 1m, and on overdue
const THRESHOLDS = [3600, 900, 300, 60]; // seconds

// ── useNotifications hook ─────────────────────────────────────
// Drop this in your root component (page.tsx) and pass trades + account
export function useNotifications(trades: Trade[], account: string) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [notifications, setNotifications] = useState<ILNotification[]>([]);
  // Track which (tradeId + threshold) combos we've already fired
  const firedRef = useRef<Set<string>>(new Set());

  // Request permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Add an in-app notification
  const addNotification = useCallback((n: Omit<ILNotification, 'id' | 'ts' | 'read'>) => {
    const notif: ILNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts: Date.now(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev].slice(0, 50)); // keep last 50
    return notif;
  }, []);

  // Fire a browser push notification
  const pushBrowser = useCallback((title: string, body: string, icon = '⚖') => {
    if (permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: title, // dedupe same-title notifications
        silent: false,
      });
    } catch { /* Safari sometimes throws */ }
  }, [permission]);

  // Fire both in-app + browser notification
  const fire = useCallback((
    type: ILNotification['type'],
    title: string,
    body: string,
    tradeId?: string,
  ) => {
    addNotification({ type, title, body, tradeId });
    pushBrowser(title, body);
  }, [addNotification, pushBrowser]);

  // ── Main polling loop — runs every 10 seconds ─────────────────
  useEffect(() => {
    if (!account || trades.length === 0) return;

    const check = () => {
      const now = Math.floor(Date.now() / 1000);

      trades.forEach(trade => {
        const isMyTrade =
          trade.buyer.toLowerCase() === account.toLowerCase() ||
          trade.seller.toLowerCase() === account.toLowerCase();
        if (!isMyTrade) return;

        const isBuyer = trade.buyer.toLowerCase() === account.toLowerCase();
        const isActive = ['Funded', 'InTransit'].includes(trade.state);
        if (!isActive) return;

        const diff = trade.deadline - now;
        const ethAmt = formatEth(trade.amount);
        const id = shortenId(trade.id);

        // ── Overdue alert ──────────────────────────────────────
        const overdueKey = `${trade.id}:overdue`;
        if (diff <= 0 && !trade.sellerSlashed && !firedRef.current.has(overdueKey)) {
          firedRef.current.add(overdueKey);
          if (isBuyer) {
            fire('danger',
              '⚡ Slashing Available — Act Now',
              `Trade ${id} is OVERDUE. You can now seize the ${trade.slashingPenaltyBps / 100}% penalty (${ethAmt} ETH).`,
              trade.id,
            );
          } else {
            fire('danger',
              '⚠ Delivery Overdue',
              `Trade ${id} deadline has passed. The buyer may initiate slashing against your escrow.`,
              trade.id,
            );
          }
          return; // don't also fire threshold alerts
        }

        // ── Threshold alerts ───────────────────────────────────
        THRESHOLDS.forEach(threshold => {
          const key = `${trade.id}:${threshold}`;
          if (diff > 0 && diff <= threshold && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            const label =
              threshold === 3600 ? '1 hour' :
              threshold === 900  ? '15 minutes' :
              threshold === 300  ? '5 minutes' : '1 minute';

            if (isBuyer) {
              fire('warning',
                `⏱ Deadline in ${label}`,
                `Trade ${id} for ${ethAmt} ETH expires in ${label}. Confirm delivery or prepare to slash.`,
                trade.id,
              );
            } else {
              fire('warning',
                `⏱ Delivery Deadline in ${label}`,
                `Trade ${id} for ${ethAmt} ETH — mark delivered within ${label} to avoid slashing.`,
                trade.id,
              );
            }
          }
        });
      });
    };

    check(); // immediate check on mount
    const id = setInterval(check, 10_000); // every 10 seconds
    return () => clearInterval(id);
  }, [trades, account, fire]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    permission,
    requestPermission,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
  };
}

// ── Notification Bell Button ──────────────────────────────────
export function NotificationBell({
  unreadCount,
  onClick,
  permission,
  onRequestPermission,
}: {
  unreadCount: number;
  onClick: () => void;
  permission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (unreadCount > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [unreadCount]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={permission === 'default' ? onRequestPermission : onClick}
        title={
          permission === 'default' ? 'Enable notifications' :
          permission === 'denied'  ? 'Notifications blocked in browser settings' :
          `${unreadCount} unread notifications`
        }
        style={{
          position: 'relative',
          background: unreadCount > 0 ? 'rgba(255,170,0,0.06)' : 'transparent',
          border: `1px solid ${unreadCount > 0 ? 'rgba(255,170,0,0.3)' : C.border}`,
          borderRadius: '6px',
          padding: '7px 10px',
          cursor: permission === 'denied' ? 'not-allowed' : 'pointer',
          color: unreadCount > 0 ? C.warn : C.dim,
          fontSize: '16px',
          lineHeight: 1,
          transition: 'all 0.2s',
          animation: pulse ? 'bellShake 0.4s ease' : 'none',
          opacity: permission === 'denied' ? 0.4 : 1,
          minHeight: '36px',
          minWidth: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {permission === 'default' ? '🔕' : permission === 'denied' ? '🔕' : '🔔'}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: C.danger,
            color: '#fff',
            fontSize: '9px',
            fontWeight: 700,
            fontFamily: C.mono,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 8px ${C.danger}`,
            animation: 'badgePop 0.3s ease',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ── Notification Panel (dropdown) ─────────────────────────────
export function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClear,
  onClose,
  permission,
  onRequestPermission,
}: {
  notifications: ILNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  onClose: () => void;
  permission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const typeColor: Record<ILNotification['type'], string> = {
    danger:  C.danger,
    warning: C.warn,
    success: C.accent,
    info:    C.blue,
  };

  const typeIcon: Record<ILNotification['type'], string> = {
    danger:  '⚡',
    warning: '⏱',
    success: '✓',
    info:    '◈',
  };

  const timeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 98 }}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute',
        top: '44px',
        right: 0,
        width: '340px',
        maxWidth: 'calc(100vw - 24px)',
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        zIndex: 99,
        overflow: 'hidden',
        animation: 'panelSlide 0.2s ease',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.text, letterSpacing: '0.08em' }}>
              Notifications
            </span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span style={{ marginLeft: '8px', fontSize: '9px', padding: '2px 7px', background: `${C.danger}20`, border: `1px solid ${C.danger}40`, borderRadius: '100px', color: C.danger, fontWeight: 700 }}>
                {notifications.filter(n => !n.read).length} new
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {notifications.length > 0 && (
              <>
                <button onClick={onMarkAllRead} style={{ background: 'none', border: 'none', color: C.dim, fontSize: '10px', cursor: 'pointer', fontFamily: C.mono, letterSpacing: '0.08em', padding: '2px 6px' }}>
                  Mark all read
                </button>
                <button onClick={onClear} style={{ background: 'none', border: 'none', color: C.dim, fontSize: '10px', cursor: 'pointer', fontFamily: C.mono, letterSpacing: '0.08em', padding: '2px 6px' }}>
                  Clear
                </button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>✕</button>
          </div>
        </div>

        {/* Permission banner */}
        {permission === 'default' && (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(184,255,0,0.04)',
            borderBottom: `1px solid rgba(184,255,0,0.12)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '11px', color: C.mid, lineHeight: 1.5 }}>
              Enable browser alerts for deadline warnings.
            </span>
            <button
              onClick={onRequestPermission}
              style={{
                padding: '5px 12px',
                background: 'rgba(184,255,0,0.1)',
                border: `1px solid rgba(184,255,0,0.3)`,
                borderRadius: '4px',
                color: C.accent,
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: C.mono,
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                minHeight: '30px',
              }}
            >
              Enable
            </button>
          </div>
        )}

        {permission === 'denied' && (
          <div style={{ padding: '10px 16px', background: 'rgba(255,53,53,0.04)', borderBottom: `1px solid rgba(255,53,53,0.12)` }}>
            <span style={{ fontSize: '11px', color: '#ff7070', lineHeight: 1.5 }}>
              Notifications blocked. Enable them in your browser site settings.
            </span>
          </div>
        )}

        {/* Notification list */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.dim, fontSize: '12px', lineHeight: 1.7 }}>
              <div style={{ fontSize: '28px', marginBottom: '10px', opacity: 0.3 }}>🔔</div>
              No notifications yet.<br />
              <span style={{ fontSize: '11px' }}>Alerts fire when deadlines approach.</span>
            </div>
          ) : (
            notifications.map((n, i) => {
              const color = typeColor[n.type];
              const icon  = typeIcon[n.type];
              return (
                <div
                  key={n.id}
                  onClick={() => onMarkRead(n.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: i < notifications.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: n.read ? 'transparent' : `${color}06`,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: `${color}15`,
                    border: `1px solid ${color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: n.read ? C.mid : color, lineHeight: 1.3 }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '9px', color: C.dim, fontFamily: C.mono, flexShrink: 0, marginTop: '1px' }}>
                        {timeAgo(n.ts)}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: n.read ? C.dim : C.mid, lineHeight: 1.5 }}>
                      {n.body}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0, marginTop: '6px', boxShadow: `0 0 6px ${color}` }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: `1px solid ${C.border}`,
          background: C.surface,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '9px', color: C.dim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Polling every 10s
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: permission === 'granted' ? C.accent : C.dim,
              boxShadow: permission === 'granted' ? `0 0 6px ${C.accent}` : 'none',
            }} />
            <span style={{ fontSize: '9px', color: permission === 'granted' ? C.accent : C.dim }}>
              {permission === 'granted' ? 'Push enabled' : permission === 'denied' ? 'Push blocked' : 'Push off'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Toast component — auto-dismiss in-page alert ──────────────
export function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: ILNotification | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const colorMap: Record<ILNotification['type'], string> = {
    danger:  C.danger,
    warning: C.warn,
    success: C.accent,
    info:    C.blue,
  };
  const color = colorMap[notification.type];

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      maxWidth: '340px',
      width: 'calc(100vw - 48px)',
      background: C.panel,
      border: `1px solid ${color}40`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '8px',
      padding: '14px 16px',
      zIndex: 999,
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}15`,
      animation: 'toastSlide 0.3s ease',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color, marginBottom: '4px', fontFamily: C.mono }}>
          {notification.title}
        </div>
        <div style={{ fontSize: '11px', color: C.mid, lineHeight: 1.5 }}>
          {notification.body}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: C.dim, fontSize: '14px', cursor: 'pointer', padding: '0', flexShrink: 0, lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Notification keyframes (inject once into <head>) ──────────
export function NotificationStyles() {
  return (
    <style>{`
      @keyframes bellShake {
        0%,100% { transform: rotate(0deg); }
        20%      { transform: rotate(-12deg); }
        40%      { transform: rotate(12deg); }
        60%      { transform: rotate(-8deg); }
        80%      { transform: rotate(8deg); }
      }
      @keyframes badgePop {
        0%   { transform: scale(0); }
        70%  { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      @keyframes panelSlide {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes toastSlide {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `}</style>
  );
}