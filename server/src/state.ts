import type { GatewayEvent, GatewayStatus, Session } from './types.js';

const MAX_EVENTS = 200;

class AppState {
  sessions: Map<string, Session> = new Map();
  events: GatewayEvent[] = [];
  status: GatewayStatus = {
    mode: 'mock',
    connected: false,
    lastEventAt: null,
    reconnectAttempts: 0,
    endpoint: '',
  };

  pushEvent(event: GatewayEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
    this.status.lastEventAt = event.timestamp;
  }

  upsertSession(session: Session): void {
    this.sessions.set(session.id, session);
  }

  removeSession(id: string): void {
    this.sessions.delete(id);
  }

  getSnapshot() {
    return {
      sessions: Array.from(this.sessions.values()),
      events: this.events.slice(-50),
      status: { ...this.status },
    };
  }
}

export const state = new AppState();
