# OVH Ubuntu Server Setup + Deployment (Laravel + Vite)

This guide takes you from a **fresh OVH Ubuntu server** to a **running production deployment**.

It is written to **not break your current Windows/XAMPP setup**: everything here is server-side + `.env`-based.

---

## 0) Assumptions

- Ubuntu **22.04/24.04** on OVH.
- You will serve the app on a **subdomain** (ex: `kpi.company.tld`).
- Backend is Laravel (in `backend/`).
- Frontend is Vite/React (in `frontend/`) and is built into **Laravel public/** (`backend/public`).
- DB is MySQL.
- Web server is **Nginx + PHP-FPM**.
- Upload storage in production will use **OVH Object Storage** (S3-compatible).

---

## 1) First login + basic OS hardening

### Commands

```bash
ssh ubuntu@SERVER_IP

# Update
sudo apt update
sudo apt -y upgrade

# Create a dedicated deploy user (optional but recommended)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Basic firewall
sudo apt -y install ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Mock output (what you should expect)

- `sudo ufw status`:

```text
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

## 2) Install runtime dependencies

### 2.1 Install Nginx

```bash
sudo apt -y install nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Mock:

```text
● nginx.service - A high performance web server and a reverse proxy server
     Active: active (running)
```

### 2.2 Install MySQL server (or use managed DB)

```bash
sudo apt -y install mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql

sudo mysql_secure_installation
```

Mock:
- You will be prompted to set root password, remove anonymous users, etc.

### 2.3 Install PHP 8.2/8.3 + required extensions

Laravel 8 supports PHP 8.0–8.2 best; PHP 8.3 may work but test first.

Recommended for stability on launch: **PHP 8.2**.

```bash
sudo apt -y install php8.2-fpm php8.2-cli php8.2-mysql \
  php8.2-xml php8.2-mbstring php8.2-curl php8.2-zip php8.2-gd \
  php8.2-bcmath php8.2-intl

# For Redis cache (if you enable it)
sudo apt -y install php8.2-redis
```

Mock:

```text
Setting up php8.2-fpm ...
Created symlink /etc/systemd/system/multi-user.target.wants/php8.2-fpm.service → /lib/systemd/system/php8.2-fpm.service.
```

### 2.4 Install Composer

```bash
cd /tmp
curl -sS https://getcomposer.org/installer -o composer-setup.php
sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer
composer --version
```

Mock:

```text
Composer version 2.x.x
```

### 2.5 Install Node.js (for building frontend)

Use Node 18 or 20 LTS.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v
npm -v
```

Mock:

```text
v20.x.x
10.x.x
```

### 2.6 Install Redis (recommended for cache + sessions)

```bash
sudo apt -y install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

redis-cli ping
```

Mock:

```text
PONG
```

---

## 3) Create folders (split storage from code)

We’ll use a simple “shared storage + current release” layout.

```bash
sudo mkdir -p /var/www/hse-kpi
sudo mkdir -p /var/www/hse-kpi/shared
sudo mkdir -p /var/www/hse-kpi/shared/storage
sudo mkdir -p /var/www/hse-kpi/releases

sudo chown -R www-data:www-data /var/www/hse-kpi/shared/storage
```

---

## 4) Deploy code

You can deploy by Git clone or by SCP.

### Option A: Git clone (recommended)

```bash
cd /var/www/hse-kpi/releases
sudo -u deploy git clone YOUR_REPO_URL release-$(date +%Y%m%d%H%M%S)
```

Then symlink `current`:

```bash
cd /var/www/hse-kpi
sudo ln -sfn /var/www/hse-kpi/releases/release-YYYYMMDDHHMMSS current
```

### Symlink persistent storage into the backend

From the repo root we assume:
- backend path is `backend/`

```bash
sudo rm -rf /var/www/hse-kpi/current/backend/storage
sudo ln -s /var/www/hse-kpi/shared/storage /var/www/hse-kpi/current/backend/storage

# Ensure cache folder exists
sudo mkdir -p /var/www/hse-kpi/current/backend/bootstrap/cache
sudo chown -R www-data:www-data /var/www/hse-kpi/current/backend/bootstrap/cache
```

---

## 5) Backend install (Laravel)

```bash
cd /var/www/hse-kpi/current/backend

# Install deps
composer install --no-dev --optimize-autoloader

# Copy env (first time)
cp .env.example .env

# Generate key
php artisan key:generate
```

Now edit `.env`:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://kpi.company.tld`
- DB credentials
- `FRONTEND_URL=https://kpi.company.tld`

Cache config:

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Storage symlink (public uploads):

```bash
php artisan storage:link
```

Mock:

```text
The [public/storage] link has been connected to [storage/app/public].
```

---

## 6) Frontend build (Vite)

```bash
cd /var/www/hse-kpi/current/frontend
npm ci
npm run build
```

Mock:

```text
vite v5.x.x building for production...
✓ built in 8.12s
```

This produces a `dist/` folder.

In this repo, the frontend build output is configured to go directly into:

- `backend/public/`

So the app can be served from Laravel’s `public/` directory in production.

---

## 7) Nginx site config (Laravel + SPA + PHP-FPM)

Create Nginx file:

```bash
sudo nano /etc/nginx/sites-available/hse-kpi
```

Use this template (HTTP only first; SSL in the SSL guide):

```nginx
server {
  listen 80;
  server_name kpi.company.tld;

  root /var/www/hse-kpi/current/backend/public;
  index index.php;

  # Upload/body size for imports
  client_max_body_size 30m;

  # Static assets
  location ~* \.(?:css|js|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000";
    try_files $uri /index.php?$query_string;
  }

  # Main Laravel handler (also serves SPA routes via routes/web.php)
  location / {
    try_files $uri $uri/ /index.php?$query_string;
  }

  # PHP-FPM
  location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
  }

  # Security: block hidden files
  location ~ /\. {
    deny all;
  }
}
```

Enable the site:

```bash
sudo ln -sfn /etc/nginx/sites-available/hse-kpi /etc/nginx/sites-enabled/hse-kpi
sudo nginx -t
sudo systemctl reload nginx
```

Mock:

```text
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## 8) OVH Object Storage (S3-compatible) for uploads

For scalability (and to avoid local disk issues), store uploads in OVH Object Storage.

### Backend .env (production)

- Set `FILESYSTEM_DISK=s3`
- Fill the S3-compatible vars:

```env
FILESYSTEM_DISK=s3

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=...            # depends on your OVH storage region
AWS_BUCKET=...
AWS_ENDPOINT=https://s3.<region>.cloud.ovh.net

# Optional (leave blank if you don't have a CDN URL)
AWS_URL=

# If you have issues listing/putting objects, try setting to true
AWS_USE_PATH_STYLE_ENDPOINT=false
```

Notes:

- If you use S3 for uploads, `php artisan storage:link` is **not required** for those objects.
- Any existing local-public uploads will remain under `storage/app/public` (keep them only if you still need local disk).

---

## 9) Performance & scalability (Redis + OPcache + MySQL tuning)

This section is **optional** and controlled by `.env`, so it **won’t affect Windows** unless you opt-in.

### 9.1 Enable Redis for Laravel cache + sessions

In production `backend/.env`:

```env
CACHE_DRIVER=redis
SESSION_DRIVER=redis

# Optional: if you later use queues
# QUEUE_CONNECTION=redis

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null

# Optional: separate DB indexes
REDIS_DB=0
REDIS_CACHE_DB=1

# Optional: avoid key collisions
CACHE_PREFIX=hse_kpi_prod
REDIS_PREFIX=hse_kpi_prod
```

Then refresh config:

```bash
cd /var/www/hse-kpi/current/backend
php artisan config:cache
```

Quick sanity check (optional):

```bash
php artisan tinker
```

In Tinker:

```php
cache()->put('redis_test', 'ok', 60);
cache()->get('redis_test');
```

Expected output:

```text
=> "ok"
```

### 9.2 PHP OPcache (PHP-FPM)

Install the OPcache package:

```bash
sudo apt -y install php8.2-opcache
```

Edit OPcache settings:

```bash
sudo nano /etc/php/8.2/fpm/conf.d/10-opcache.ini
```

Recommended baseline (good for production + your release/symlink deploy):

```ini
opcache.enable=1
opcache.enable_cli=0
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
opcache.revalidate_freq=0
opcache.fast_shutdown=1
```

Reload PHP-FPM:

```bash
sudo systemctl reload php8.2-fpm
```

Verify OPcache:

```bash
php -i | grep -i opcache.enable
```

Mock:

```text
opcache.enable => On => On
```

Deployment note:

- With `opcache.validate_timestamps=0`, PHP won’t notice file changes automatically.
- Your deploy process already uses a **new release folder + symlink switch**, so this is safe.
- After each deploy, reload PHP-FPM to ensure old workers are recycled.

### 9.3 MySQL baseline tuning (starter)

Your server (8 vCPU / 32 GB RAM) can benefit from a larger InnoDB buffer pool.

Edit MySQL config:

```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

Add under `[mysqld]` (starter values):

```ini
# InnoDB
innodb_buffer_pool_size = 16G
innodb_buffer_pool_instances = 8
innodb_log_file_size = 1G
innodb_flush_log_at_trx_commit = 2

# Connections (adjust if you see too many connections)
max_connections = 300

# Slow query log (very useful to optimize)
slow_query_log = 1
slow_query_log_file = /var/log/mysql/mysql-slow.log
long_query_time = 1
```

Notes:

- `innodb_flush_log_at_trx_commit=2` improves write performance with a small durability trade-off.
- If you need maximum durability, set it back to `1`.

Restart MySQL:

```bash
sudo systemctl restart mysql
```

Quick check:

```bash
sudo mysql -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
```

Mock:

```text
+-------------------------+------------+
| Variable_name           | Value      |
+-------------------------+------------+
| innodb_buffer_pool_size | 17179869184|
+-------------------------+------------+
```

---

## 10) Post-deploy checklist

---

- `curl -I http://kpi.company.tld` should return 200
- `curl -I http://kpi.company.tld/api/health` (if you have a health route)
- Confirm uploads work (storage + permissions)

---

## 11) What to do on each update (simple deploy procedure)

1. Pull new code into a new release folder
2. Symlink storage
3. `composer install --no-dev`
4. `php artisan migrate --force`
5. `php artisan config:cache`
6. Build frontend (`npm ci && npm run build`)
7. Reload php-fpm and nginx

---

## Notes: what can break between Windows and Linux

- File permissions (Linux requires proper owner/group on `storage`)
- Case sensitivity of filenames (Linux is case-sensitive)
- Path separators (avoid hardcoded `C:\...` paths in production `.env`)
- `ZipArchive`, `GD`, `PDO_mysql` must be installed/enabled

