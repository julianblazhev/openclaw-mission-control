import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { loadConfig } from './config.js';
import { GatewayClient } from './gateway-client.js';
import { MockGateway } from './mock-gateway.js';
import { setupRealtime } from './realtime.js';
import { state } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

// --- REST endpoints ---

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: config.mockGateway ? 'mock' : 'real',
    serverTime: new Date().toISOString(),
    gatewayConnected: state.status.connected,
  });
});

app.get('/gateway/status', (_req, res) => {
  res.json({
    endpoint: config.mockGateway ? 'mock://local' : config.gateway.ws,
    mode: config.mockGateway ? 'mock' : 'real',
    connected: state.status.connected,
    lastEventAt: state.status.lastEventAt,
    reconnectAttempts: state.status.reconnectAttempts,
  });
});

// --- Serve frontend in production ---
if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// --- Start server ---

const server = createServer(app);

// Start gateway source (real or mock)
const source = config.mockGateway ? new MockGateway() : new GatewayClient(config);

// Setup WebSocket /realtime endpoint
setupRealtime(server, source);

server.listen(config.port, () => {
  console.log(`\n🚀 Mission Control server running on port ${config.port}`);
  console.log(`   Mode: ${config.mockGateway ? 'MOCK' : 'REAL'}`);
  console.log(`   Health: http://localhost:${config.port}/health`);
  console.log(`   Realtime WS: ws://localhost:${config.port}/realtime\n`);
  source.start();
});
