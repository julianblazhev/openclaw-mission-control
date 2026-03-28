import { useState, useEffect, useRef, useCallback } from 'react';

export interface Session {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'closed';
  startedAt: string;
  lastActivityAt: string;
  metadata: Record<string, unknown>;
}

export interface GatewayEvent {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface GatewayStatus {
  mode: 'real' | 'mock';
  connected: boolean;
  lastEventAt: string | null;
  reconnectAttempts: number;
  endpoint: string;
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface RealtimeState {
  connectionState: ConnectionState;
  status: GatewayStatus | null;
  sessions: Session[];
  events: GatewayEvent[];
}

const MAX_EVENTS = 100;

export function useRealtime(): RealtimeState {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const attempts = useRef(0);

  const connect = useCallback(() => {
    const apiBase = import.meta.env.VITE_API_BASE ?? '';
    const wsBase = apiBase.replace(/^http/, 'ws');
    const url = `${wsBase}/realtime`;

    setConnectionState(attempts.current === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attempts.current = 0;
      setConnectionState('connected');
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'snapshot') {
        setSessions(msg.data.sessions ?? []);
        setEvents(msg.data.events ?? []);
        setStatus(msg.data.status ?? null);
      } else if (msg.type === 'delta') {
        const evt: GatewayEvent = msg.data;
        setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), evt]);

        // Update sessions from session_update deltas
        if (evt.type === 'session_update' && evt.payload) {
          const action = evt.payload.action as string;
          if (action === 'started' && evt.payload.session) {
            setSessions((prev) => [...prev, evt.payload.session as Session]);
          } else if (action === 'closed' && evt.payload.sessionId) {
            setSessions((prev) => prev.filter((s) => s.id !== evt.payload.sessionId));
          } else if (action === 'activity' && evt.payload.sessionId) {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === evt.payload.sessionId
                  ? { ...s, status: (evt.payload.status as Session['status']) ?? s.status, lastActivityAt: evt.timestamp }
                  : s,
              ),
            );
          }
        }
      } else if (msg.type === 'status') {
        setStatus(msg.data);
      }
    };

    ws.onclose = () => {
      setConnectionState('reconnecting');
      attempts.current++;
      const delay = Math.min(1000 * 2 ** attempts.current, 15000);
      reconnectTimer.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connectionState, status, sessions, events };
}
