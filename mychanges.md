# 🐳 Dockerization Changes — AQMS

> All changes made to dockerize the frontend and backend with dynamic configuration support.

---

## Backend Changes

### 1. Updated `backend/Dockerfile`

**Before:**
```dockerfile
# Hugging Face Spaces — FastAPI backend for AQMS
FROM python:3.9-slim

# HF Spaces runs on port 7860
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

**After:**
```dockerfile
# FastAPI backend for AQMS
FROM python:3.9-slim

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000

ENTRYPOINT ["python"]
CMD ["main.py"]
```

**What changed:**
- Port changed from `7860` (Hugging Face Spaces) → `8000` (standard) for consistency with local dev
- Removed HF Spaces-specific comments
- Changed from direct `uvicorn` CMD to `ENTRYPOINT ["python"]` + `CMD ["main.py"]`, leveraging the uvicorn startup already defined in `main.py`
- `ENTRYPOINT` + `CMD` split allows overriding the script: `docker run aqms-backend other_script.py`

---

## Frontend Changes

### 2. Created `frontend/Dockerfile` (new file)

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY ./package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

**Key decisions:**
- Multi-stage build: Node.js builds the app, only the static `dist/` output is copied to the final nginx image (keeps image small)
- `npm ci` for deterministic, reproducible installs
- Custom `nginx.conf` for SPA routing support
- `entrypoint.sh` for runtime backend URL injection
- `ENTRYPOINT` runs the config injection script, then `exec`s into `CMD` (nginx)

---

### 3. Created `frontend/nginx.conf` (new file)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

**Why needed:**
- Default nginx config returns 404 for any route other than `/`
- `try_files $uri $uri/ /index.html` makes React Router work — all routes (e.g., `/dashboard`, `/map`) serve `index.html` and let React handle routing client-side
- Static assets get 1-year cache headers for performance
- `index.html` is explicitly never cached so users always get the latest version

---

### 4. Created `frontend/entrypoint.sh` (new file)

```sh
#!/bin/sh

: ${BACKEND_HOST:=localhost}
: ${BACKEND_PORT:=8000}

cat << EOF > /usr/share/nginx/html/config.js

window.__BACKEND_URL__ = "http://${BACKEND_HOST}:${BACKEND_PORT}";
EOF

exec "$@"
```

**Why needed:**
- Vite's `import.meta.env.VITE_*` variables are baked in at **build time** — passing `-e VITE_API_URL=...` at `docker run` has no effect
- This script runs at **container startup** (before nginx), dynamically generating a `config.js` file with the backend URL
- `: ${VAR:=default}` sets defaults if env vars aren't provided
- `exec "$@"` passes control to CMD (nginx) so the container runs normally
- **Result:** One Docker image works in any environment — just change `-e BACKEND_HOST` and `-e BACKEND_PORT`

---

### 5. Updated `frontend/index.html`

**Before:**
```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
```

**After:**
```html
<body>
  <div id="root"></div>
  <script src="/config.js"></script>
  <script type="module" src="/src/main.jsx"></script>
</body>
```

**What changed:**
- Added `<script src="/config.js">` **before** the React app script
- `config.js` sets `window.__BACKEND_URL__` globally before React initializes
- Must be loaded first so `api.js` can read the value during module initialization

---

### 6. Updated `frontend/src/services/api.js`

**Before:**
```javascript
const API_BASE = import.meta.env.VITE_API_URL
  || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://aqms-backend-ue5x.onrender.com');
```

**After:**
```javascript
const API_BASE = import.meta.env.VITE_API_URL
  || window.__BACKEND_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://aqms-backend-ue5x.onrender.com');
```

**What changed:**
- Added `window.__BACKEND_URL__` as the second fallback in the URL resolution chain
- **Priority order:** `VITE_API_URL` (build-time) → `window.__BACKEND_URL__` (runtime injection via Docker) → `localhost` detection → hardcoded production URL

---

## How to Run

```bash
# Build
docker build -t aqms-backend ./backend
docker build -t aqms-frontend ./frontend

# Run backend on port 8001
docker run -d --name aqms-api -p 8001:8000 aqms-backend

# Run frontend on port 3000, pointing to backend at localhost:8001
docker run -d --name aqms-web -p 3000:80 \
  -e BACKEND_HOST=localhost \
  -e BACKEND_PORT=8001 \
  aqms-frontend

# Open http://localhost:3000
```

---

## Summary of Files Changed/Created

| File | Action | Purpose |
|---|---|---|
| `backend/Dockerfile` | Modified | Standardized port to 8000, switched to `python main.py` |
| `frontend/Dockerfile` | **Created** | Multi-stage build with nginx + runtime config injection |
| `frontend/nginx.conf` | **Created** | SPA routing + static asset caching |
| `frontend/entrypoint.sh` | **Created** | Runtime backend URL injection via `config.js` |
| `frontend/index.html` | Modified | Added `config.js` script tag before React app |
| `frontend/src/services/api.js` | Modified | Added `window.__BACKEND_URL__` to URL fallback chain |
