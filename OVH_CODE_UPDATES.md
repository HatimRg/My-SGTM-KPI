# OVH Code Updates (Production Deploy) — Releases + Current Symlink (Laravel + Vite)

This guide explains a safe way to push code updates to your OVH Ubuntu server using a **release folder** strategy:

- Each deploy goes to a new folder under `releases/`
- You switch the live app by changing the `current` symlink
- You can rollback instantly by switching the symlink back

Assumed structure:

- `/var/www/hse-kpi/releases/` (timestamped releases)
- `/var/www/hse-kpi/shared/storage` (persistent Laravel storage)
- `/var/www/hse-kpi/current` -> points to the active release

---

## 1) Before you deploy (one-time)

### 1.1 Confirm shared storage symlink exists

Your Laravel storage must be shared across releases:

- `/var/www/hse-kpi/current/backend/storage` -> `/var/www/hse-kpi/shared/storage`

Command:

```bash
ls -la /var/www/hse-kpi/current/backend/storage
```

Mock:

```text
lrwxrwxrwx 1 root root 29 Jan 01 12:00 /var/www/hse-kpi/current/backend/storage -> /var/www/hse-kpi/shared/storage
```

### 1.2 Ensure permissions are correct

```bash
sudo chown -R www-data:www-data /var/www/hse-kpi/shared/storage
sudo chown -R www-data:www-data /var/www/hse-kpi/current/backend/bootstrap/cache
```

---

## 2) Deploy method A (recommended): Git clone a new release

### 2.1 Create a new release folder

```bash
release=$(date +%Y%m%d%H%M%S)
cd /var/www/hse-kpi/releases
sudo -u deploy git clone YOUR_REPO_URL release-$release
```

### 2.2 Point `current` to the new release

```bash
sudo ln -sfn /var/www/hse-kpi/releases/release-$release /var/www/hse-kpi/current
```

### 2.3 Re-create the storage symlink inside the new release

```bash
sudo rm -rf /var/www/hse-kpi/current/backend/storage
sudo ln -s /var/www/hse-kpi/shared/storage /var/www/hse-kpi/current/backend/storage

sudo mkdir -p /var/www/hse-kpi/current/backend/bootstrap/cache
sudo chown -R www-data:www-data /var/www/hse-kpi/current/backend/bootstrap/cache
```

---

## 3) Install/update backend dependencies (Laravel)

```bash
cd /var/www/hse-kpi/current/backend
composer install --no-dev --optimize-autoloader
```

If you changed `.env` values, refresh caches:

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

If you are actively debugging, you can temporarily avoid caches:

```bash
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

---

## 4) Database migrations

```bash
cd /var/www/hse-kpi/current/backend
php artisan migrate --force
```

Mock:

```text
Migrating: 2025_12_25_120000_add_index_to_workers_table
Migrated:  2025_12_25_120000_add_index_to_workers_table (0.21 seconds)
```

---

## 5) Frontend build (Vite)

Your repo builds the frontend into Laravel public (`backend/public`).

```bash
cd /var/www/hse-kpi/current/frontend
npm ci
npm run build
```

Mock:

```text
vite v5.x.x building for production...
✓ built in 9.01s
```

---

## 6) Reload services (PHP-FPM + Nginx)

Reload PHP-FPM (important after deploys, especially with OPcache enabled):

```bash
sudo systemctl reload php8.2-fpm
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Mock:

```text
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## 7) (Optional but recommended) Maintenance mode during deploy

If you want to prevent users from hitting partial deploy states:

```bash
cd /var/www/hse-kpi/current/backend
php artisan down
```

Deploy steps...

Bring it back:

```bash
php artisan up
```

---

## 8) Quick post-deploy verification

### 8.1 Check HTTP response

```bash
curl -I https://kpi.company.tld
```

Expected:

```text
HTTP/2 200
```

### 8.2 Check API (authenticated routes require session/token)

If you have (or add) a health route, test it:

```bash
curl -I https://kpi.company.tld/api/health
```

---

## 9) Rollback (fast)

If a deploy breaks production, rollback by pointing `current` back to the previous known-good release.

### 9.1 List releases

```bash
ls -1 /var/www/hse-kpi/releases | tail -n 10
```

### 9.2 Switch symlink to an older release

```bash
sudo ln -sfn /var/www/hse-kpi/releases/release-YYYYMMDDHHMMSS /var/www/hse-kpi/current

sudo systemctl reload php8.2-fpm
sudo systemctl reload nginx
```

If you use OPcache with `validate_timestamps=0`, reloading PHP-FPM is critical so old cached bytecode is dropped.

---

## 10) Common issues

- **502 Bad Gateway**
  - Check PHP-FPM is running:

  ```bash
  sudo systemctl status php8.2-fpm
  ```

- **Assets missing / old UI**
  - Re-run frontend build (`npm run build`) and confirm it outputs to `backend/public/assets`

- **Changes not applied**
  - Clear/rebuild Laravel caches:

  ```bash
  cd /var/www/hse-kpi/current/backend
  php artisan optimize:clear
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  sudo systemctl reload php8.2-fpm
  ```

- **Permission errors**
  - Ensure `storage/` and `bootstrap/cache` are writable by `www-data`.

---

## 11) If you want a “single command deploy”

Tell me whether you prefer:

- A bash script (`deploy.sh`) stored on the server
- Or a CI-based deploy (GitHub Actions) that SSHes into OVH
