# OpenClaw Mission Control

Real-time dashboard for monitoring OpenClaw via gateway-first integration.

```
OpenClaw Gateway -> Mission Control Backend -> Mission Control Frontend
```

The backend owns the gateway connection and token. The frontend never communicates directly with the OpenClaw gateway.

## Architecture

- **server/** — Node.js + Express + WebSocket backend
- **web/** — React + Vite frontend dashboard
- Backend connects to OpenClaw Gateway (real or mock mode)
- Backend exposes `/realtime` WebSocket for frontend updates
- Gateway token is server-side only — never sent to browser

## Quick Start

```bash
npm install
cp .env.example .env
```

### Scripts

| Scope  | Command               | Description                          |
|--------|-----------------------|--------------------------------------|
| Root   | `npm run dev`         | Start server + web concurrently      |
| Root   | `npm run build`       | Build server + web for production    |
| Root   | `npm start`           | Start production server              |
| Root   | `npm run gateway:test`| Test backend gateway connection      |
| Server | `npm run dev -w server`  | Dev server with hot reload        |
| Server | `npm run build -w server`| Build server TypeScript           |
| Web    | `npm run dev -w web`     | Vite dev server                   |
| Web    | `npm run build -w web`   | Build frontend for production     |
| Web    | `npm run preview -w web` | Preview production build          |

---

## Phase A — Local Development (outside VPS)

Use mock mode to develop without a real OpenClaw instance.

### 1. Configure

```bash
cp .env.example .env
# Ensure these values in .env:
MOCK_GATEWAY=true
PORT=8787
VITE_API_BASE=http://localhost:8787
```

### 2. Run

```bash
npm install
npm run dev
```

### 3. Verify

- Open http://localhost:5173
- Dashboard shows "Mock" connection badge
- Sessions appear and update automatically
- Live event feed populates every 3-6 seconds

---

## Phase B — VPS Production (real OpenClaw)

Deploy on the same VPS where OpenClaw runs.

### 1. Ensure OpenClaw Gateway is running

```bash
openclaw gateway status
# If not running:
openclaw gateway start
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```
MOCK_GATEWAY=false
PORT=8787
OPENCLAW_GATEWAY_WS=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_HTTP=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<your-real-gateway-token>
VITE_API_BASE=http://localhost:8787
```

### 3. Build and start

```bash
npm install
npm run build
npm start
```

### 4. Test gateway connection

In a separate terminal:
```bash
npm run gateway:test
```

Expected output:
```
✅ Connected to backend /realtime
✅ PASS: Received "snapshot" event
   Mode: real
   Sessions: 3
   Events in buffer: 12
```

### 5. Set up Nginx reverse proxy

```bash
sudo cp nginx.conf /etc/nginx/sites-available/mission-control.conf
sudo ln -s /etc/nginx/sites-available/mission-control.conf /etc/nginx/sites-enabled/
# Edit server_name in the config
sudo nginx -t && sudo systemctl reload nginx
```

For TLS:
```bash
sudo certbot --nginx -d mission-control.yourdomain.com
```

### 6. Docker deployment (alternative)

```bash
docker compose up -d --build
```

---

## Security

- **Gateway token** is a server-side environment variable only
- Frontend connects to backend `/realtime` WebSocket — never to the gateway directly
- Nginx exposes only the Mission Control app; gateway port (18789) stays private
- Browser devtools/network tab will never show the gateway token

### Token Rotation

1. Generate new token in OpenClaw
2. Update `OPENCLAW_GATEWAY_TOKEN` in `.env`
3. Restart the server: `npm start` (or `docker compose restart`)
4. Run `npm run gateway:test` to confirm the new token works

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Dashboard shows "Disconnected" | Is the server running? `curl http://localhost:8787/health` |
| Server starts but gateway fails | Is `MOCK_GATEWAY=false`? Is the token valid? Is gateway running? |
| gateway:test times out | Start the server first: `npm run dev -w server` |
| Reconnecting loop | Check `GET /gateway/status` for reconnect attempts. Verify gateway is reachable |
| No sessions in real mode | Gateway may have no active sessions. Check `openclaw gateway status` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health + mode + gateway status |
| `/gateway/status` | GET | Detailed gateway connection info |
| `/realtime` | WS | Real-time event stream for frontend |
