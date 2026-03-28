import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (two levels up from server/src/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface Config {
  port: number;
  mockGateway: boolean;
  gateway: {
    ws: string;
    http: string;
    token: string;
  };
}

function requiredEnv(key: string, value: string | undefined, mode: string): string {
  if (!value || value === 'replace_me') {
    console.error(
      `\n❌ FATAL: ${key} is required when MOCK_GATEWAY=false (real gateway mode).\n` +
      `   Set ${key} in your .env or environment.\n`
    );
    process.exit(1);
  }
  return value;
}

export function loadConfig(): Config {
  const mockGateway = (process.env.MOCK_GATEWAY ?? 'false').toLowerCase() === 'true';
  const port = parseInt(process.env.PORT ?? '8787', 10);

  const gatewayWs = process.env.OPENCLAW_GATEWAY_WS ?? 'ws://127.0.0.1:18789';
  const gatewayHttp = process.env.OPENCLAW_GATEWAY_HTTP ?? 'http://127.0.0.1:18789';
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

  if (!mockGateway) {
    requiredEnv('OPENCLAW_GATEWAY_TOKEN', gatewayToken, 'real');
  }

  return {
    port,
    mockGateway,
    gateway: {
      ws: gatewayWs,
      http: gatewayHttp,
      token: gatewayToken,
    },
  };
}
