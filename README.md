# Дело в пицце

Pizza-delivery site. React SPA (Vite) + Go backend for payments and Telegram notifications.

## Stack

- **Frontend:** React 18, Vite 5, plain CSS. Two entry points: customer (`/`) and admin (`/admin`).
- **Backend:** Go 1.23, stdlib `net/http`. Endpoints under `/api/*`. Stateless HTTP proxy to YooKassa + Telegram Bot API. iiko CRM integration is a stub pending credentials.
- **Production:** nginx serves built static assets, proxies `/api/*` to backend container. `docker-compose` orchestrates both.

## Quick start (dev, no Docker)

```bash
# 1. Backend
cd backend
cp ../.env.example ../.env   # fill values
go run ./cmd/server          # :8080

# 2. Frontend (separate terminal)
npm install
npm run dev                  # :5173 — proxies /api → :8080
```

## Quick start (Docker)

```bash
cp .env.example .env         # fill values
docker compose up --build    # frontend :80, backend internal :8080
```

Visit `http://localhost`.

## Project layout

```
.
├── backend/                 # Go HTTP API
│   ├── cmd/server/          # main.go
│   ├── internal/
│   │   ├── config/          # env loading
│   │   ├── handlers/        # HTTP handlers
│   │   ├── yookassa/        # YooKassa REST client (54-ФЗ receipt)
│   │   ├── telegram/        # Telegram Bot API client
│   │   └── iiko/            # stub
│   ├── Dockerfile           # Go 1.23-alpine → alpine 3.20
│   └── go.mod
├── src/                     # React app (customer + admin)
├── public/                  # static assets (logo)
├── docs/screenshots/        # design iteration screenshots (not deployed)
├── Dockerfile               # node 20 build → nginx 1.27 static serve
├── nginx.conf               # SPA fallback + /api proxy + security headers
├── docker-compose.yml       # backend + frontend services
└── vite.config.js           # build config + dev proxy
```

## API

All endpoints under `/api/*`. Same-origin in prod (nginx proxies).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | liveness probe |
| POST | `/api/create-payment` | create YooKassa payment, returns `confirmation_url` |
| POST | `/api/notify-telegram` | send order notification to Telegram chat |
| POST | `/api/iiko/order` | stub — returns 501 until iiko integration finished |

## Configuration

Required env vars (see `.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `YOOKASSA_SHOP_ID` | yes | YooKassa merchant ID |
| `YOOKASSA_SECRET` | yes | YooKassa secret key (live or test) |
| `TG_BOT_TOKEN` | no | Telegram bot token (notifications disabled if empty) |
| `TG_CHAT_ID` | no | Telegram chat ID (supergroups: `-100<id>`) |
| `PORT` | no | Backend port (default 8080) |
| `ALLOW_ORIGIN` | no | CORS origin (leave empty in prod same-origin setup) |

## Production deployment

By default `docker-compose.yml` binds the frontend to **`127.0.0.1:8080`** on the host. Public traffic must go through an external nginx with TLS — never expose `:8080` directly to the internet.

### TLS termination via host nginx + Let's Encrypt

1. **Install nginx + certbot on host (Ubuntu/Debian example):**
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Copy server config:**
   ```bash
   sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/pizza.conf
   sudo sed -i 's/pizza.example.com/your-real-domain.ru/g' /etc/nginx/sites-available/pizza.conf
   sudo ln -s /etc/nginx/sites-available/pizza.conf /etc/nginx/sites-enabled/pizza.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. **Get certificates:**
   ```bash
   sudo certbot --nginx -d your-real-domain.ru -d www.your-real-domain.ru
   ```
   Certbot edits the config to add valid cert paths automatically. Renewal runs via systemd timer.

4. **Tighten HSTS** after a few days of stable traffic — increase `max-age` to `31536000; preload` in `nginx-host.conf`.

5. **Firewall:** only `:80` and `:443` should be open inbound. `:8080` is localhost-only by virtue of compose binding (`127.0.0.1:8080:80`).

### To bind compose elsewhere (e.g. different host port)
```bash
FRONTEND_BIND=127.0.0.1:9000 docker compose up -d
```

2. **Secrets:** `.env` is git-ignored. Keep secrets out of version control. On the server, set strict perms: `chmod 600 .env`.

3. **First deploy:**
   ```bash
   git clone <repo> /opt/pizza && cd /opt/pizza
   cp .env.example .env && $EDITOR .env
   docker compose up -d --build
   docker compose logs -f
   ```

4. **Update:**
   ```bash
   git pull && docker compose up -d --build
   ```

5. **Healthchecks:** both services have HTTP healthchecks. `docker compose ps` shows status. Compose waits for backend to be healthy before starting frontend.

6. **Resource limits:** backend 256MB / 0.5 CPU, frontend 128MB / 0.5 CPU — adjust in `docker-compose.yml` if needed.

7. **Logs:** json-file driver, 10MB × 5 rotation per service. View with `docker compose logs <service>`.

8. **Telegram chat ID:** supergroup IDs need the `-100` prefix (e.g., `-1001234567890`). Plain `-123…` is legacy group format and may fail with "chat not found".

## Local production build (without Docker)

```bash
npm run build                # outputs to dist/
cd backend && go build -ldflags="-s -w" -o server ./cmd/server
./server                     # backend
# serve dist/ via any static server, proxy /api → :8080
```

## Notes

- iiko CRM integration is a stub. When credentials arrive, implement `backend/internal/iiko/client.go` and the existing `/api/iiko/order` handler will start working.
- YooKassa payment confirmation is client-side (return URL with query params). Async webhook (`/api/yookassa/webhook`) is not yet implemented — reliable for current flow because payments complete or fail before redirect.
- Admin panel auth is currently client-side only (localStorage). Do not consider it secure against motivated attackers — restrict via IP or HTTP basic auth at nginx level if needed.
