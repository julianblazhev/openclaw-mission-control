import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { Config } from './config.js';
import type { GatewayEvent, Session } from './types.js';
import { state } from './state.js';

const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private config: Config) {
    super();
  }

  start(): void {
    this.stopped = false;
    state.status.mode = 'real';
    state.status.endpoint = this.config.gateway.ws;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    const url = new URL(this.config.gateway.ws);
    // Support token via query parameter
    if (this.config.gateway.token) {
      url.searchParams.set('token', this.config.gateway.token);
    }

    console.log(`[gateway] Connecting to ${this.config.gateway.ws}...`);

    this.ws = new WebSocket(url.toString(), {
      headers: this.config.gateway.token
        ? { Authorization: `Bearer ${this.config.gateway.token}` }
        : {},
    });

    this.ws.on('open', () => {
      console.log('[gateway] Connected');
      state.status.connected = true;
      state.status.reconnectAttempts = 0;

      const evt: GatewayEvent = {
        type: 'connected',
        timestamp: new Date().toISOString(),
        payload: { endpoint: this.config.gateway.ws },
      };
      state.pushEvent(evt);
      this.emit('event', evt);
    });

    this.ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(msg);
      } catch {
        console.warn('[gateway] Failed to parse message:', raw.toString().slice(0, 200));
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[gateway] Disconnected: ${code} ${reason}`);
      state.status.connected = false;
      const evt: GatewayEvent = {
        type: 'disconnected',
        timestamp: new Date().toISOString(),
        payload: { code, reason: reason.toString() },
      };
      state.pushEvent(evt);
      this.emit('event', evt);
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[gateway] Error:', err.message);
      state.status.connected = false;
      const evt: GatewayEvent = {
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: { message: err.message },
      };
      state.pushEvent(evt);
      this.emit('event', evt);
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    // Normalize gateway messages into our event schema
    const type = (msg.type as string) ?? 'event';

    if (type === 'snapshot' && Array.isArray(msg.sessions)) {
      for (const s of msg.sessions as Session[]) {
        state.upsertSession(s);
      }
      const evt: GatewayEvent = {
        type: 'snapshot',
        timestamp: new Date().toISOString(),
        payload: { sessionCount: (msg.sessions as Session[]).length },
      };
      state.pushEvent(evt);
      this.emit('event', evt);
      return;
    }

    if (type === 'session_update' && msg.session) {
      const session = msg.session as Session;
      if (session.status === 'closed') {
        state.removeSession(session.id);
      } else {
        state.upsertSession(session);
      }
    }

    const evt: GatewayEvent = {
      type: type as GatewayEvent['type'],
      timestamp: new Date().toISOString(),
      payload: msg,
    };
    state.pushEvent(evt);
    this.emit('event', evt);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    state.status.reconnectAttempts++;
    const delay = Math.min(BASE_DELAY * 2 ** (state.status.reconnectAttempts - 1), MAX_DELAY);
    console.log(`[gateway] Reconnecting in ${delay}ms (attempt ${state.status.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
