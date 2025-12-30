# Domain + Subdomain Setup (Company main domain → KPI subdomain)

This guide explains how to point a **subdomain** of your existing company domain to your OVH server.

Example:
- Company domain: `company.tld`
- KPI app subdomain: `kpi.company.tld`

---

## 1) Decide where DNS is managed

It can be:
- OVH DNS zone, or
- Cloudflare, or
- Another provider

You must edit DNS where the **authoritative name servers** are set.

---

## 2) Create the DNS record

### Option A: A record (IPv4)
Create an **A** record:

- **Type:** `A`
- **Name:** `kpi`
- **Target:** `SERVER_IP` (example: `13.60.74.118`)
- **TTL:** default (ex: 300s)

This makes `kpi.company.tld` resolve to your server.

### Option B: AAAA record (IPv6)
If OVH provides IPv6 and you want it:

- **Type:** `AAAA`
- **Name:** `kpi`
- **Target:** `YOUR_IPV6`

---

## 3) Verify DNS propagation

From your laptop/PC:

```bash
nslookup kpi.company.tld
```

Mock output:

```text
Server:  8.8.8.8
Name:    kpi.company.tld
Address: 13.60.74.118
```

Or:

```bash
dig +short kpi.company.tld
```

Mock:

```text
13.60.74.118
```

Propagation can take from seconds to hours.

---

## 4) Nginx/Apache must match server_name

Once DNS points to your server, make sure your web server is configured with:

- `server_name kpi.company.tld;`

If it’s wrong, you may see a default Nginx page.

---

## 5) TLS/SSL note

You can only issue a valid Let’s Encrypt certificate after:
- DNS record exists
- Port **80** is reachable
- `kpi.company.tld` resolves to your server

Then follow `SSL_HTTPS_SETUP.md`.

---

## Common mistakes

- Editing DNS in the wrong provider (not authoritative)
- A record points to old IP
- Firewall blocks ports 80/443
- Nginx `server_name` mismatch

