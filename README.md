# ДОН ГИДРО ДЕКОР — dgd61.ru

Лендинг компании. Node.js (Express) + статика. Nginx reverse proxy. SSL через Certbot.

---

## Деплой на VPS (Ubuntu 22.04)

### 1. Подготовка сервера

```bash
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx git nodejs npm
```

### 2. Клонирование репозитория

```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/dmitrikostukov93-collab/gidro.git dgd61
cd dgd61
```

### 3. Установка зависимостей (только production)

```bash
npm install --omit=dev
```

### 4. Создание .env файла

```bash
nano /var/www/dgd61/.env
```

Содержимое (заменить значения на реальные):
```
PORT=3000
MANAGER_EMAIL=asylummm@yandex.ru
SMTP_PASS=re_ВАШ_RESEND_API_KEY
SMTP_FROM=info@dgd61.ru
```

### 5. PM2 — автозапуск Node.js

```bash
npm install -g pm2
cd /var/www/dgd61
pm2 start server.js --name dgd61
pm2 save
pm2 startup   # выполнить команду которую выведет PM2
```

### 6. Nginx

```bash
cp /var/www/dgd61/nginx.conf /etc/nginx/sites-available/dgd61.ru
ln -s /etc/nginx/sites-available/dgd61.ru /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 7. SSL — Certbot

```bash
certbot --nginx -d dgd61.ru -d www.dgd61.ru
```

Авто-обновление уже настроено через systemd timer. Проверить:
```bash
systemctl status certbot.timer
```

### 8. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 9. Проверка

```bash
pm2 status
nginx -t
curl -I https://dgd61.ru
```

---

## Обновление сайта

```bash
cd /var/www/dgd61
git pull
pm2 restart dgd61
```

---

## Локальная разработка

```bash
npm install
npm start
# Открыть http://localhost:3000
```

---

## Структура

```
index_real.html          — главная страница
galereya.html            — галерея работ
gidroizolyaciya-vanny-rostov.html
gidroizolyaciya-fundamenta.html
dekorativnaya-shtukaturka-svoimi-rukami.html
kontakty.html
server.js                — Express: API /api/submit, отдача страниц
nginx.conf               — конфиг nginx (скопировать в sites-available)
sitemap.xml
robots.txt
assets/                  — шрифты, изображения, лого, фавиконки
```

---

## Переменные окружения (.env)

| Переменная      | Описание                          |
|-----------------|-----------------------------------|
| PORT            | Порт Node.js (по умолч. 3000)    |
| MANAGER_EMAIL   | Email для получения заявок        |
| SMTP_PASS       | Resend API key (re_...)          |
| SMTP_FROM       | От кого (info@dgd61.ru)          |
