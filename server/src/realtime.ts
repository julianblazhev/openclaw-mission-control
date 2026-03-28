import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { EventEmitter } from 'events';
import type { GatewayEvent, RealtimeMessage } from './types.js';
import { state } from './state.js';

export function setupRealtime(server: Server, source: EventEmitter): void {
  const wss = new WebSocketServer({ server, path: '/realtime' });

  wss.on('connection', (ws) => {
    console.log(`[realtime] Client connected (total: ${wss.clients.size})`);

    // Send initial snapshot
    const msg: RealtimeMessage = {
      type: 'snapshot',
      data: state.getSnapshot(),
    };
    ws.send(JSON.stringify(msg));

    ws.on('close', () => {
      console.log(`[realtime] Client disconnected (total: ${wss.clients.size})`);
    });
  });

  // Forward gateway/mock events to all connected frontend clients
  source.on('event', (event: GatewayEvent) => {
    const msg: RealtimeMessage = { type: 'delta', data: event };
    const payload = JSON.stringify(msg);

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  // Periodically send status updates
  setInterval(() => {
    const msg: RealtimeMessage = { type: 'status', data: { ...state.status } };
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }, 5000);
}
