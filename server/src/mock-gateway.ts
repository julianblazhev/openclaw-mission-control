import { EventEmitter } from 'events';
import type { GatewayEvent, Session } from './types.js';
import { state } from './state.js';

const NAMES = ['alpha-miner', 'beta-scanner', 'gamma-indexer', 'delta-crawler', 'epsilon-watcher'];
const STATUSES: Session['status'][] = ['active', 'idle'];

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function randomSession(): Session {
  const now = new Date().toISOString();
  return {
    id: `sess_${randomId()}`,
    name: NAMES[Math.floor(Math.random() * NAMES.length)]!,
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)]!,
    startedAt: now,
    lastActivityAt: now,
    metadata: { pid: Math.floor(Math.random() * 60000) + 1000 },
  };
}

export class MockGateway extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    state.status.mode = 'mock';
    state.status.endpoint = 'mock://local';
    state.status.connected = true;
    state.status.reconnectAttempts = 0;

    console.log('[mock-gateway] Starting mock event generator');

    // Seed initial sessions
    for (let i = 0; i < 3; i++) {
      const session = randomSession();
      state.upsertSession(session);
    }

    const snapshotEvt: GatewayEvent = {
      type: 'snapshot',
      timestamp: new Date().toISOString(),
      payload: { sessionCount: state.sessions.size },
    };
    state.pushEvent(snapshotEvt);
    this.emit('event', snapshotEvt);

    // Emit synthetic events every 3-6 seconds
    this.interval = setInterval(() => {
      const roll = Math.random();

      if (roll < 0.3) {
        // New session
        const session = randomSession();
        state.upsertSession(session);
        const evt: GatewayEvent = {
          type: 'session_update',
          timestamp: new Date().toISOString(),
          payload: { action: 'started', session },
        };
        state.pushEvent(evt);
        this.emit('event', evt);
      } else if (roll < 0.5 && state.sessions.size > 1) {
        // Remove a session
        const sessions = Array.from(state.sessions.values());
        const target = sessions[Math.floor(Math.random() * sessions.length)]!;
        state.removeSession(target.id);
        const evt: GatewayEvent = {
          type: 'session_update',
          timestamp: new Date().toISOString(),
          payload: { action: 'closed', sessionId: target.id, name: target.name },
        };
        state.pushEvent(evt);
        this.emit('event', evt);
      } else if (roll < 0.7) {
        // Activity event
        const sessions = Array.from(state.sessions.values());
        if (sessions.length > 0) {
          const target = sessions[Math.floor(Math.random() * sessions.length)]!;
          target.lastActivityAt = new Date().toISOString();
          target.status = Math.random() > 0.5 ? 'active' : 'idle';
          state.upsertSession(target);
          const evt: GatewayEvent = {
            type: 'session_update',
            timestamp: new Date().toISOString(),
            payload: { action: 'activity', sessionId: target.id, name: target.name, status: target.status },
          };
          state.pushEvent(evt);
          this.emit('event', evt);
        }
      } else {
        // Generic event
        const types = ['block_found', 'peer_connected', 'sync_progress', 'health_check'];
        const evt: GatewayEvent = {
          type: 'event',
          timestamp: new Date().toISOString(),
          payload: {
            kind: types[Math.floor(Math.random() * types.length)],
            value: Math.floor(Math.random() * 1000),
            node: `node-${Math.floor(Math.random() * 5) + 1}`,
          },
        };
        state.pushEvent(evt);
        this.emit('event', evt);
      }
    }, 3000 + Math.floor(Math.random() * 3000));
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    state.status.connected = false;
  }
}
