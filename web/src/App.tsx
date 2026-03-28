import { useRealtime } from './useRealtime';
import type { Session, GatewayEvent } from './useRealtime';

export function App() {
  const { connectionState, status, sessions, events } = useRealtime();

  return (
    <div>
      <Header connectionState={connectionState} mode={status?.mode ?? null} />
      <div className="grid">
        <StatsBar sessions={sessions} status={status} />
        <div className="panels">
          <SessionsPanel sessions={sessions} />
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Header ---------- */

function Header({ connectionState, mode }: { connectionState: string; mode: string | null }) {
  const badgeColor: Record<string, string> = {
    connected: 'var(--green)',
    connecting: 'var(--yellow)',
    reconnecting: 'var(--orange)',
    disconnected: 'var(--red)',
  };

  const label = mode === 'mock' && connectionState === 'connected'
    ? 'Mock'
    : connectionState.charAt(0).toUpperCase() + connectionState.slice(1);

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
        <span style={{ color: 'var(--accent)' }}>OpenClaw</span> Mission Control
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', background: 'var(--surface)', borderRadius: '9999px', border: '1px solid var(--border)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: badgeColor[connectionState] ?? 'var(--red)', display: 'inline-block', boxShadow: `0 0 6px ${badgeColor[connectionState] ?? 'var(--red)'}` }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{label}</span>
      </div>
    </header>
  );
}

/* ---------- Stats Bar ---------- */

function StatsBar({ sessions, status }: { sessions: Session[]; status: ReturnType<typeof useRealtime>['status'] }) {
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const idleSessions = sessions.filter((s) => s.status === 'idle').length;

  const stats = [
    { label: 'Total Sessions', value: sessions.length },
    { label: 'Active', value: activeSessions, color: 'var(--green)' },
    { label: 'Idle', value: idleSessions, color: 'var(--yellow)' },
    { label: 'Reconnects', value: status?.reconnectAttempts ?? 0 },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color ?? 'var(--text)', marginTop: '0.25rem' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Sessions Panel ---------- */

function SessionsPanel({ sessions }: { sessions: Session[] }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', flex: 1, minWidth: 0, overflow: 'auto' }}>
      <h2 style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions</h2>
      {sessions.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No active sessions</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>
                  <StatusDot status={s.status} />
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.id.slice(0, 12)}</td>
                <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{formatTime(s.lastActivityAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { active: 'var(--green)', idle: 'var(--yellow)', closed: 'var(--red)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[status] ?? 'var(--text-dim)', display: 'inline-block' }} />
      {status}
    </span>
  );
}

/* ---------- Event Feed ---------- */

function EventFeed({ events }: { events: GatewayEvent[] }) {
  const reversed = [...events].reverse();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', flex: 1, minWidth: 0, maxHeight: '500px', overflow: 'auto' }}>
      <h2 style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Event Feed</h2>
      {reversed.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Waiting for events...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {reversed.map((e, i) => (
            <div key={`${e.timestamp}-${i}`} style={{ display: 'flex', gap: '0.75rem', padding: '0.35rem 0', borderBottom: '1px solid var(--surface-2)', fontSize: '0.78rem', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(e.timestamp)}</span>
              <EventBadge type={e.type} />
              <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summarizePayload(e.payload)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    connected: 'var(--green)',
    disconnected: 'var(--red)',
    error: 'var(--red)',
    snapshot: 'var(--accent)',
    session_update: 'var(--yellow)',
    event: 'var(--text-dim)',
  };
  return (
    <span style={{ padding: '0.1rem 0.4rem', borderRadius: '0.25rem', background: `${colors[type] ?? 'var(--text-dim)'}22`, color: colors[type] ?? 'var(--text-dim)', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {type}
    </span>
  );
}

/* ---------- Helpers ---------- */

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 0.5rem', color: 'var(--text-dim)', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '0.5rem', verticalAlign: 'middle' };

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function summarizePayload(p: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === 'type') continue;
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    parts.push(`${k}=${val.slice(0, 40)}`);
    if (parts.length >= 3) break;
  }
  return parts.join(' | ') || '—';
}
