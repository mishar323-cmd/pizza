# Deploy guide — reg.ru VPS

Цель: задеплоить стек на `194.67.120.49` (Ubuntu 26, root). Без домена пока — на IP.

## Step 1: SSH вход
На твоей машине (не на VPS):
```bash
ssh root@194.67.120.49
# пароль: 8B1uh3lfGMF104bu
```

Когда внутри — увидишь приглашение `root@hostname:~#`. Дальше команды выполняются на сервере.

## Step 2: Установить пакеты (Docker, nginx, certbot)
Скопируй вот этот блок целиком и вставь в SSH-сессию:

```bash
curl -fsSL https://raw.githubusercontent.com/MISHAR-RUBAN/PLACEHOLDER/main/deploy/server-setup.sh -o /tmp/setup.sh 2>/dev/null || cat > /tmp/setup.sh <<'EOF'
PASTE_SETUP_SCRIPT_HERE
EOF
bash /tmp/setup.sh
```

Альтернатива (если репо не на GitHub) — сделай шаг 3 первым, потом запусти `bash /opt/pizza/deploy/server-setup.sh`.

## Step 3: Загрузить код на VPS
На локальной машине (не на VPS):
```bash
cd /Users/mikhail/Desktop/projects/pizza
rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude '*.png' --exclude .DS_Store \
  --exclude backend/server --exclude _design --exclude docs \
  --exclude .playwright-mcp --exclude .claude --exclude .env \
  ./ root@194.67.120.49:/opt/pizza/
```

## Step 4: Сгенерить production .env
На VPS (через SSH):
```bash
cd /opt/pizza
cat > .env <<EOF
YOOKASSA_SHOP_ID=1125271
YOOKASSA_SECRET=live_uczSrBXiaIb5Q8-dXb7lpwMqVXNh2PvbUScLHC7Pvm8
TG_BOT_TOKEN=8835723400:AAHB8ji3A2SoMJ_QAf7lSrwJrX-UaRCl-yk
TG_CHAT_ID=-5110986573
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ADMIN_LOGIN=admin
ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
ADMIN_NAME=Михаил
FRONTEND_BIND=0.0.0.0:80
EOF
chmod 600 .env
echo "=== СОХРАНИ ADMIN_PASSWORD ==="
grep ADMIN_PASSWORD .env
echo "=============================="
```

> Без домена биндимся на `0.0.0.0:80` чтобы открыть по IP. После домена + TLS — поменяем обратно на `127.0.0.1:8080` и host nginx будет проксировать.

## Step 5: Запуск стека
```bash
cd /opt/pizza
docker compose up -d --build
sleep 5
docker compose ps
```

Все три контейнера должны быть `healthy` (через 15-30 сек).

## Step 6: Smoke test
```bash
curl -s http://localhost/api/health
curl -s -o /dev/null -w "/ → %{http_code}\n" http://localhost/
curl -s -o /dev/null -w "/admin/ → %{http_code}\n" http://localhost/admin/
```

С локальной машины (вне VPS):
```bash
curl http://194.67.120.49/api/health
# открой http://194.67.120.49/ в браузере
# открой http://194.67.120.49/admin/ — логин admin / <ADMIN_PASSWORD из step 4>
```

## Step 7: (Опционально) Домен + TLS
Когда домен указан в DNS (A-запись на 194.67.120.49):

```bash
# на VPS
cd /opt/pizza

# 7a. сменить bind на localhost-only
sed -i 's|FRONTEND_BIND=.*|FRONTEND_BIND=127.0.0.1:8080|' .env
docker compose up -d  # пересоздаст frontend с новым портом

# 7b. подставить домен в nginx-host.conf и активировать
DOMAIN=пицца.рф  # ← заменить на свой
sed "s/pizza.example.com/$DOMAIN/g" deploy/nginx-host.conf > /etc/nginx/sites-available/pizza.conf
ln -sf /etc/nginx/sites-available/pizza.conf /etc/nginx/sites-enabled/pizza.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 7c. сертификат
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m mikeruban@mail.ru
```

## Безопасность после деплоя
1. Сменить root SSH пароль или отключить root login + добавить SSH ключ:
   ```bash
   passwd  # сменить пароль root
   # или (рекомендую) добавить ssh ключ и отрубить пароль:
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   echo "<твой публичный ключ>" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   # потом отредактировать /etc/ssh/sshd_config: PasswordAuthentication no
   systemctl reload ssh
   ```
2. `ADMIN_PASSWORD` из .env — это креды от админки. Сохрани надёжно.
3. Сменить `ADMIN_PASSWORD` через SQL после первого входа (или добавлю эндпоинт смены пароля).

## Обновление после деплоя
```bash
# локально
rsync -avz --delete --exclude node_modules --exclude dist --exclude .git \
  --exclude '*.png' --exclude .DS_Store --exclude backend/server --exclude _design \
  --exclude docs --exclude .playwright-mcp --exclude .claude --exclude .env \
  ./ root@194.67.120.49:/opt/pizza/

# на VPS
cd /opt/pizza && docker compose up -d --build
```
