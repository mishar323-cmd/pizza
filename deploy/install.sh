#!/usr/bin/env bash
# One-shot installer for pizza stack on fresh Ubuntu 22/24 VPS as root.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mishar323-cmd/pizza/main/deploy/install.sh | bash

set -euo pipefail

REPO_URL="https://github.com/mishar323-cmd/pizza.git"
APP_DIR="/root/pizza"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mFAIL: %s\033[0m\n' "$*" >&2; exit 1; }

if [[ $EUID -ne 0 ]]; then
  fail "Run as root."
fi

log "Cleaning up any prior broken Docker apt source"
rm -f /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.gpg

log "apt update + base tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release ufw nginx certbot python3-certbot-nginx openssl git

log "Installing Docker from official repo"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
ARCH=$(dpkg --print-architecture)
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' "$ARCH" "$CODENAME" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker --version

log "Configuring UFW firewall (22, 80, 443)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo y | ufw enable

log "Stopping host nginx (compose will use port 80)"
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
[ -f /etc/nginx/sites-enabled/default ] && mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak

log "Fetching code from GitHub"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull --ff-only
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  log "Generating .env with random secrets"
  PG_PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  JWT_S=$(openssl rand -base64 48 | tr -d '\n=')
  ADM_PW=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
  cat > .env <<EOF
YOOKASSA_SHOP_ID=1125271
YOOKASSA_SECRET=live_uczSrBXiaIb5Q8-dXb7lpwMqVXNh2PvbUScLHC7Pvm8
TG_BOT_TOKEN=8835723400:AAHB8ji3A2SoMJ_QAf7lSrwJrX-UaRCl-yk
TG_CHAT_ID=-5110986573
POSTGRES_PASSWORD=$PG_PW
JWT_SECRET=$JWT_S
ADMIN_LOGIN=admin
ADMIN_PASSWORD=$ADM_PW
ADMIN_NAME=Mikhail
FRONTEND_BIND=0.0.0.0:80
EOF
  chmod 600 .env
else
  log ".env already exists — keeping current values"
fi

log "Building + starting docker compose stack (this can take 3-7 min)"
docker compose up -d --build

log "Waiting 25s for healthchecks…"
sleep 25

log "Container status"
docker compose ps

log "API health"
curl -fsS http://localhost/api/health || true
echo

ADM_LOGIN=$(grep '^ADMIN_LOGIN=' .env | cut -d= -f2)
ADM_PW=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2)

IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

printf '\n\033[1;32m=============================================\033[0m\n'
printf '\033[1;32m  DEPLOY DONE\033[0m\n'
printf '\033[1;32m=============================================\033[0m\n'
printf '  Site:        http://%s/\n' "$IP"
printf '  Admin URL:   http://%s/admin/\n' "$IP"
printf '  Admin login: %s\n' "$ADM_LOGIN"
printf '  Admin pass:  %s\n' "$ADM_PW"
printf '\033[1;32m=============================================\033[0m\n'
printf '  Update later: cd %s && git pull && docker compose up -d --build\n' "$APP_DIR"
printf '  Env file:    %s/.env (chmod 600)\n' "$APP_DIR"
printf '\033[1;32m=============================================\033[0m\n\n'
