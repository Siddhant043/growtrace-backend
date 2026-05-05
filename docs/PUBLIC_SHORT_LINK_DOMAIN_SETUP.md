# Public Short Link Domain Setup

This runbook configures GrowTrace to:

- keep API traffic on `api.growtrace.in`
- serve customer-facing short links on `go.growtrace.in`

The redirect handler remains the same Express route:

- `GET /r/:shortCode` in `server/src/api/routes/redirect.ts`

---

## 1) Server Configuration

Set this environment variable on the server deployment:

```env
SHORT_LINK_BASE_URL=https://go.growtrace.in
```

`SHORT_LINK_BASE_URL` is used when building `shortUrl` for create/list/get/update link responses.

---

## 2) DNS Configuration

Create a DNS record for the public short-link host:

- Type: `A` or `CNAME` (depends on your ingress/load balancer)
- Host: `go`
- Value: your public ingress/load balancer endpoint

Keep the existing API DNS record unchanged:

- `api.growtrace.in` -> API ingress/load balancer

---

## 3) TLS/Certificate

Ensure the certificate presented by ingress includes:

- `go.growtrace.in`
- `api.growtrace.in`

Examples:

- wildcard: `*.growtrace.in`
- or SAN certificate containing both hosts

---

## 4) NGINX / Ingress Routing

Use host-based routing so both domains can point to the same backend safely.

### Recommended host behavior

- `api.growtrace.in`:
  - allow API endpoints (`/api/*`, `/track`, auth, etc.)
- `go.growtrace.in`:
  - allow `GET /r/:shortCode`
  - optionally allow `/api/health`
  - return `404` for unrelated paths

### Example NGINX config

```nginx
server {
    listen 443 ssl http2;
    server_name api.growtrace.in;

    # ssl_certificate ...
    # ssl_certificate_key ...

    location / {
        proxy_pass http://growtrace_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name go.growtrace.in;

    # ssl_certificate ...
    # ssl_certificate_key ...

    location /r/ {
        proxy_pass http://growtrace_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/health {
        proxy_pass http://growtrace_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        return 404;
    }
}
```

---

## 5) Rollout Checklist

1. Deploy server with `SHORT_LINK_BASE_URL=https://go.growtrace.in`.
2. Add DNS for `go.growtrace.in`.
3. Attach/update TLS certificate for both hosts.
4. Apply ingress/NGINX host rules.
5. Verify new links are returned as `https://go.growtrace.in/r/<shortCode>`.
6. Verify old `https://api.growtrace.in/r/<shortCode>` links continue to redirect during transition.

---

## 6) Verification Commands

Check redirect host:

```bash
curl -I "https://go.growtrace.in/r/<shortCode>"
```

Check API host remains API-only:

```bash
curl -I "https://api.growtrace.in/api/health"
```

Check create-link response host in `shortUrl`:

- create link via dashboard
- confirm returned `shortUrl` starts with `https://go.growtrace.in/`

