# SSL/HTTPS Setup (Let’s Encrypt) for the KPI subdomain

This guide assumes:
- You already created the subdomain DNS (see `DOMAIN_SUBDOMAIN_SETUP.md`).
- Your app is reachable on **HTTP** first.
- You are using **Nginx** on Ubuntu.

---

## 1) Confirm port 80 works before SSL

On the server:

```bash
curl -I http://kpi.company.tld
```

Mock:

```text
HTTP/1.1 200 OK
Server: nginx
```

If this fails, fix DNS/firewall/Nginx first.

---

## 2) Install Certbot

```bash
sudo apt update
sudo apt -y install certbot python3-certbot-nginx
```

Mock:

```text
Setting up certbot ...
```

---

## 3) Issue the certificate

```bash
sudo certbot --nginx -d kpi.company.tld
```

Mock interactive flow:

```text
Saving debug log to /var/log/letsencrypt/letsencrypt.log

Please enter the email address (for urgent renewal and security notices)
 (Enter 'c' to cancel): admin@company.tld

Do you agree to the Terms of Service? (Y)es/(N)o: Y

Would you be willing to share your email address with the EFF? (Y)es/(N)o: N

Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/kpi.company.tld/fullchain.pem
Key is saved at: /etc/letsencrypt/live/kpi.company.tld/privkey.pem
This certificate expires on YYYY-MM-DD.

Deploying certificate
Successfully deployed certificate for kpi.company.tld
```

When asked about redirect:
- choose **redirect HTTP → HTTPS**.

---

## 4) Auto-renewal

Let’s Encrypt certs auto-renew via systemd timer.

Test renewal:

```bash
sudo certbot renew --dry-run
```

Mock:

```text
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/kpi.company.tld/fullchain.pem (success)
```

---

## 5) Laravel .env updates for HTTPS

In production `.env` (backend):

- `APP_URL=https://kpi.company.tld`
- `FORCE_HTTPS=true`
- `SESSION_SECURE_COOKIE=true`
- `FRONTEND_URL=https://kpi.company.tld`

Then:

```bash
cd /var/www/hse-kpi/current/backend
php artisan config:cache
```

Mock:

```text
Configuration cache cleared!
Configuration cached successfully!
```

---

## 6) Confirm HTTPS + HSTS

```bash
curl -I https://kpi.company.tld
```

Mock:

```text
HTTP/2 200
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

---

## 7) Common issues

- **Mixed content**: frontend tries to call `http://...` API.
  - Your frontend uses relative `/api`, so this is usually safe.
- **Infinite redirects**: proxy headers missing.
  - If you are behind a load balancer/reverse proxy, ensure Nginx passes `X-Forwarded-Proto`.
  - In this repo, `TrustProxies` is enabled so Laravel reads forwarded headers correctly.
  - After changing `.env`, run `php artisan config:cache`.

