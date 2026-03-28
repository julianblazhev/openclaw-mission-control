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
    console.log(`[gateway] Connecting to ${this.config.gateway.ws}...`);

    // Connect with Authorization header for OpenClaw gateway
    this.ws = new WebSocket(this.config.gateway.ws, {
      headers: this.config.gateway.token
        ? { Authorization: `Bearer ${this.config.gateway.token}` }
        : {},
    });

    this.ws.on('open', () => {
      console.log('[gateway] WebSocket open');
      state.status.connected = true;
      state.status.reconnectAttempts = 0;
    });

    this.ws.on('message', (raw) => {
      const text = raw.toString();
      console.log(`[gateway] << ${text.slice(0, 300)}`);
      try {
        const msg = JSON.parse(text);
        this.handleMessage(msg);
      } catch {
        console.warn('[gateway] Failed to parse message');
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[gateway] Disconnected: code=${code} reason="${reason}"`);
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
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    // Normalize gateway messages into our event schema
    const type = (msg.type as string) ?? 'event';
    const event = (msg.event as string) ?? '';

    // Handle OpenClaw connect_challenge — respond with token + nonce
    if (event === 'connect_challenge' || type === 'connect_challenge') {
      const payload = (msg.payload ?? {}) as Record<string, unknown>;
      const nonce = (payload.nonce as string) ?? '';
      console.log(`[gateway] Received connect_challenge (nonce: ${nonce.slice(0, 8)}...)`);

      // Respond with connect message per OpenClaw gateway protocol
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const connectMsg = {
          type: 'connect',
          params: {
            auth: { token: this.config.gateway.token },
            nonce,
            role: 'monitor',
            scopes: ['read'],
          },
        };
        this.ws.send(JSON.stringify(connectMsg));
        console.log('[gateway] Sent connect response with token + nonce');
      }
      return;
    }

    // Handle hello-ok — gateway accepted our auth
    if (event === 'hello-ok' || type === 'hello-ok' || event === 'hello_ok' || type === 'hello_ok') {
      console.log('[gateway] Authenticated successfully (hello-ok)');
      const evt: GatewayEvent = {
        type: 'connected',
        timestamp: new Date().toISOString(),
        payload: { authenticated: true },
      };
      state.pushEvent(evt);
      this.emit('event', evt);
      return;
    }

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
