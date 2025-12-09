# HTTPS Setup Guide for HSE KPI Tracker

## Option 1: Using Let's Encrypt with Certbot (Recommended for Production)

### Prerequisites
- A domain name pointing to your server
- Port 80 and 443 open on your firewall

### Steps

1. **Install Certbot on Windows**
   ```powershell
   # Download and install Certbot from https://certbot.eff.org/
   # Or use Chocolatey:
   choco install certbot
   ```

2. **Obtain SSL Certificate**
   ```powershell
   certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
   ```

3. **Configure Apache (XAMPP)**
   
   Edit `C:\xampp\apache\conf\extra\httpd-ssl.conf`:
   ```apache
   <VirtualHost *:443>
       ServerName yourdomain.com
       DocumentRoot "C:/My-SGTM-KPI/backend/public"
       
       SSLEngine on
       SSLCertificateFile "C:/Certbot/live/yourdomain.com/fullchain.pem"
       SSLCertificateKeyFile "C:/Certbot/live/yourdomain.com/privkey.pem"
       
       <Directory "C:/My-SGTM-KPI/backend/public">
           AllowOverride All
           Require all granted
       </Directory>
       
       # Proxy to Laravel
       ProxyPreserveHost On
       ProxyPass / http://127.0.0.1:8000/
       ProxyPassReverse / http://127.0.0.1:8000/
   </VirtualHost>
   ```

4. **Enable SSL Module in Apache**
   
   Edit `C:\xampp\apache\conf\httpd.conf`:
   ```apache
   LoadModule ssl_module modules/mod_ssl.so
   LoadModule proxy_module modules/mod_proxy.so
   LoadModule proxy_http_module modules/mod_proxy_http.so
   Include conf/extra/httpd-ssl.conf
   ```

5. **Update Laravel .env**
   ```env
   APP_URL=https://yourdomain.com
   ```

6. **Force HTTPS in Laravel**
   
   Add to `app/Providers/AppServiceProvider.php`:
   ```php
   public function boot()
   {
       if (config('app.env') === 'production') {
           \URL::forceScheme('https');
       }
   }
   ```

---

## Option 2: Self-Signed Certificate (Development Only)

### Generate Self-Signed Certificate

```powershell
# Create directory for certificates
New-Item -ItemType Directory -Path "C:\My-SGTM-KPI\ssl" -Force

# Generate self-signed certificate using OpenSSL
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout C:\My-SGTM-KPI\ssl\server.key `
    -out C:\My-SGTM-KPI\ssl\server.crt `
    -subj "/CN=localhost"
```

### Configure Apache for Self-Signed

Edit `C:\xampp\apache\conf\extra\httpd-ssl.conf`:
```apache
<VirtualHost *:443>
    ServerName localhost
    DocumentRoot "C:/My-SGTM-KPI/backend/public"
    
    SSLEngine on
    SSLCertificateFile "C:/My-SGTM-KPI/ssl/server.crt"
    SSLCertificateKeyFile "C:/My-SGTM-KPI/ssl/server.key"
    
    <Directory "C:/My-SGTM-KPI/backend/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

---

## Option 3: Using Cloudflare (Easiest)

1. **Add your domain to Cloudflare**
2. **Enable "Full (strict)" SSL mode**
3. **Cloudflare will handle HTTPS automatically**
4. **Your server can remain HTTP internally**

---

## Quick HTTPS Test Script

Save as `test-https.ps1`:
```powershell
# Test HTTPS connection
try {
    $response = Invoke-WebRequest -Uri "https://localhost" -SkipCertificateCheck
    Write-Host "HTTPS is working! Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "HTTPS test failed: $($_.Exception.Message)" -ForegroundColor Red
}
```

---

## Security Headers (Add to .htaccess)

```apache
# Security Headers
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
```

---

## Automatic Certificate Renewal (Let's Encrypt)

Create a scheduled task to run:
```powershell
certbot renew --quiet
```

Run this weekly to ensure certificates stay valid.
