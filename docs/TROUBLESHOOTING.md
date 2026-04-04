# Troubleshooting: Frontend Stuck on "載入中..."

## The Problem

Frontend shows "載入中..." (loading) indefinitely and doesn't proceed to login.

## Root Causes & Solutions

### 1. Frontend Deployed Without GitHub Actions Secrets ⚠️

**What it means:** The frontend build was deployed before you set the GitHub Actions secrets (`VITE_API_URL`, `VITE_WS_URL`, `VITE_BASE_PATH`).

**How to verify:**
- Open browser → Press F12 (Developer Console)
- Look for errors:
  ```
  Error: 前端 尚未設定 API URL，請在 GitHub repository secrets 中設定 VITE_API_URL。
  Error: GitHub Pages 前端尚未設定外部 WebSocket URL...
  ```

**Solution:**

1. **Ensure GitHub Actions secrets are set:**
   - Go to: `https://github.com/tszck/xkx-web/settings/secrets/actions`
   - Add/verify these

   **Secrets:**
   - `VITE_API_URL` = `https://xkx.87.106.31.154.sslip.io/api`
   - `VITE_WS_URL` = `wss://xkx.87.106.31.154.sslip.io/ws`

   **Variables:**
   - `VITE_BASE_PATH` = `/xkx-web/`

2. **Trigger a new GitHub Actions build:**
   ```bash
   cd /root/projects/xkx-web
   # Make a small change to frontend to trigger build
   echo "" >> frontend/public/index.html
   git add frontend/
   git commit -m "Trigger GitHub Actions rebuild"
   git push origin main
   ```

3. **Check the build:**
   - Go to: `https://github.com/tszck/xkx-web/actions`
   - Watch "Deploy Frontend" workflow run
   - Once complete, reload `https://tszck.github.io/xkx-web/` (hard-refresh: Ctrl+Shift+R or Cmd+Shift+R)

---

### 2. Cached Old Frontend Build 🔄

**What it means:** Browser is serving cached version without the correct endpoints.

**Solution:**
- Hard refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
- Or clear browser cache for GitHub Pages:
  - DevTools → Application → Cache Storage → Delete all

---

### 3. Backend Not Responding 🔴

**What it means:** Frontend loads but cannot connect to backend API or WebSocket.

**How to verify:**
- Press F12 → Network tab
- Look for failed requests to `xkx.87.106.31.154.sslip.io`
- Check for CORS errors or Connection refused

**Solutions:**

**Check backend is running:**
```bash
pm2 status  # Should show xkx-backend as "online"
netstat -tlnp | grep 3001  # Should show port 3001 listening
pm2 logs xkx-backend  # Check for startup errors
```

**Test API endpoint:**
```bash
curl -s 'https://xkx.87.106.31.154.sslip.io/api/auth/guest' \
  -X POST | jq .
# Should return a token, not error
```

**Test WebSocket (from server):**
```bash
# Can't easily test from command line, but API working means backend is good
curl -i 'https://xkx.87.106.31.154.sslip.io/api/auth/me'
# Should return JSON (with 401 Unauthorized), not 502 Bad Gateway
```

---

### 4. CORS Errors ❌

**Error message:**
```
Access to fetch at 'https://xkx.87.106.31.154.sslip.io/api/...' 
from origin 'https://tszck.github.io' has been blocked by CORS policy
```

**Solution:**
- Verify `backend/.env` has correct `CORS_ORIGIN`:
  ```bash
  cat /root/projects/xkx-web/backend/.env | grep CORS
  # Should show: CORS_ORIGIN=https://tszck.github.io
  ```
- If missing or wrong, update and restart backend:
  ```bash
  pm2 restart xkx-backend
  pm2 logs xkx-backend
  ```

---

### 5. WebSocket Connection Fails 🔌

**Error message:**
```
WebSocket is closed before the connection is established
```

**Verify WebSocket works:**
- Check Caddy reverse proxy config:
  ```bash
  cat /etc/caddy/Caddyfile
  # xkx.87.106.31.154.sslip.io block should have reverse_proxy localhost:3001
  ```
- Reload Caddy if you made changes:
  ```bash
  caddy reload --config /etc/caddy/Caddyfile
  ```

---

## Complete Debugging Checklist

```bash
# 1. Backend running and accessible?
pm2 status | grep xkx-backend
curl -s 'https://xkx.87.106.31.154.sslip.io/api/auth/me' -i | head -5

# 2. Correct CORS_ORIGIN set?
cat /root/projects/xkx-web/backend/.env | grep CORS_ORIGIN

# 3. Caddy properly configured?
cat /etc/caddy/Caddyfile
netstat -tlnp | grep caddy

# 4. Frontend has correct endpoints embedded?
grep "87.106.31.154" /root/projects/xkx-web/frontend/dist/assets/*.js

# 5. GitHub Actions secrets configured?
# Visit: https://github.com/tszck/xkx-web/settings/secrets/actions
# and verify VITE_API_URL, VITE_WS_URL, VITE_BASE_PATH are set

# 6. GitHub Actions recent build successful?
# Visit: https://github.com/tszck/xkx-web/actions and check latest "Deploy Frontend" run
```

---

## Quick Fix Steps

If stuck on "載入中...", try in order:

1. **Hard refresh**: Ctrl+Shift+R (clear cache and reload)
2. **Check GitHub Actions**: Did your recent push trigger a build? Check Actions tab
3. **Verify backend**: `pm2 status` should show xkx-backend online
4. **Test connectivity**: Open DevTools (F12) → Network tab, look for errors
5. **Restart backend if needed**: 
   ```bash
   pm2 restart xkx-backend
   ```
6. **Reload Caddy if config changed**:
   ```bash
   caddy reload --config /etc/caddy/Caddyfile
   ```

---

## Still Stuck?

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Copy any red error messages
4. Check that you see appropriate `Nd()` connection output showing the API URL being used
5. If it says `localhost:3000`, the GitHub Actions build hasn't deployed yet - wait for the Actions workflow to complete

