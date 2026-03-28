/** Normalized event types emitted by both real and mock gateway */
export type GatewayEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'snapshot'
  | 'session_update'
  | 'event';

export interface GatewayEvent {
  type: GatewayEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface Session {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'closed';
  startedAt: string;
  lastActivityAt: string;
  metadata: Record<string, unknown>;
}

export interface GatewaySnapshot {
  sessions: Session[];
  events: GatewayEvent[];
}

export interface GatewayStatus {
  mode: 'real' | 'mock';
  connected: boolean;
  lastEventAt: string | null;
  reconnectAttempts: number;
  endpoint: string;
}

/** What the backend sends to frontend clients over WS /realtime */
export type RealtimeMessage =
  | { type: 'snapshot'; data: GatewaySnapshot & { status: GatewayStatus } }
  | { type: 'delta'; data: GatewayEvent }
  | { type: 'status'; data: GatewayStatus };
