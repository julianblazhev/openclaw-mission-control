/**
 * gateway:test — Attempts to connect to the backend /realtime WS,
 * waits for the first event within 10s, then reports PASS/FAIL.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import WebSocket from 'ws';

const port = process.env.PORT ?? '8787';
const url = `ws://localhost:${port}/realtime`;

console.log(`\n🔍 Gateway Test — connecting to ${url}...\n`);

const ws = new WebSocket(url);
let passed = false;

const timeout = setTimeout(() => {
  if (!passed) {
    console.error('❌ FAIL: No event received within 10 seconds.');
    console.error('   Ensure the server is running: npm run dev -w server\n');
    ws.close();
    process.exit(1);
  }
}, 10000);

ws.on('open', () => {
  console.log('✅ Connected to backend /realtime');
});

ws.on('message', (raw) => {
  if (passed) return;
  passed = true;
  clearTimeout(timeout);

  try {
    const msg = JSON.parse(raw.toString());
    console.log(`✅ PASS: Received "${msg.type}" event`);
    console.log(`   Mode: ${msg.data?.status?.mode ?? 'unknown'}`);
    console.log(`   Sessions: ${msg.data?.sessions?.length ?? 'N/A'}`);
    console.log(`   Events in buffer: ${msg.data?.events?.length ?? 'N/A'}\n`);
  } catch {
    console.log('✅ PASS: Received first event (raw)\n');
  }

  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  clearTimeout(timeout);
  console.error(`❌ FAIL: Connection error — ${err.message}`);
  console.error('   Is the server running? Try: npm run dev -w server\n');
  process.exit(1);
});
