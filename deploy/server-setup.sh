#!/usr/bin/env bash
# Bootstrap Ubuntu 24/26 VPS for pizza stack.
# Run as root on a fresh VPS.

set -euo pipefail

echo "==> apt update + upgrade"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> install base packages"
apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  ufw nginx certbot python3-certbot-nginx \
  rsync git openssl

echo "==> install Docker (official repo)"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

echo "==> UFW firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

echo "==> create app user + dir"
id -u pizza >/dev/null 2>&1 || useradd -m -s /bin/bash -G docker pizza
mkdir -p /opt/pizza
chown -R pizza:pizza /opt/pizza

echo "==> done. Versions:"
docker --version
docker compose version
nginx -v
certbot --version
