# GitHub Actions Setup for Frontend Deployment

The frontend deployment to GitHub Pages requires configuring environment variables and secrets in your GitHub repository settings.

## Required Configuration

Go to your GitHub repository → **Settings** → **Secrets and variables**

### Repository Secrets (for sensitive data)

These are **encrypted** and safe to store:

#### `VITE_API_URL` (Secret)
- **Value:** `https://xkx.87.106.31.154.sslip.io/api`
- **Purpose:** Backend API endpoint for REST calls (auth, save/load)
- **Note:** Change domain if you deploy to a different VPS

#### `VITE_WS_URL` (Secret)
- **Value:** `wss://xkx.87.106.31.154.sslip.io/ws`
- **Purpose:** WebSocket endpoint for real-time game events
- **Note:** Must use `wss://` for HTTPS connections

### Repository Variables (for non-sensitive config)

These are **not encrypted** but visible to the public:

#### `VITE_BASE_PATH` (Variable)
- **Value:** `/xkx-web/`
- **Purpose:** GitHub Pages subpath (required if repo name is not your root domain)
- **Note:** Must end with `/`. Change to `/` if deploying to root domain.

## How to Set These Up

### Step 1: Navigate to Secrets and Variables

1. Go to: `https://github.com/tszck/xkx-web/settings/secrets/actions`
2. Click **New repository secret** or **New repository variable**

### Step 2: Add Secrets

Click **New repository secret** and create:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://xkx.87.106.31.154.sslip.io/api` |
| `VITE_WS_URL` | `wss://xkx.87.106.31.154.sslip.io/ws` |

### Step 3: Add Variables  

Click **New repository variable** (in the "Variables" tab) and create:

| Name | Value |
|------|-------|
| `VITE_BASE_PATH` | `/xkx-web/` |

### Step 4: Trigger Deployment

Push a change to `frontend/` directory to trigger the GitHub Actions workflow:

```bash
cd /root/projects/xkx-web
git add .
git commit -m "Trigger frontend rebuild with GitHub Actions configured"
git push origin main
```

Then check the Actions tab to see the build progress.

## Verification

After deployment completes:

1. Go to `https://tszck.github.io/xkx-web/`
2. Open browser Developer Console (F12 → Console tab)
3. Should see logs connecting to API and WebSocket (no red errors)
4. Game should load and allow login

If you still see "載入中…" (loading):
- Check the console for error messages
- Verify secrets are using HTTPS URLs (not HTTP)
- Ensure WebSocket URL uses `wss://` not `ws://`

## Environment Variables Used by Frontend

During build, the GitHub Actions workflow passes these variables:

```yaml
env:
  VITE_BASE_PATH: ${{ vars.VITE_BASE_PATH }}
  VITE_WS_URL: ${{ secrets.VITE_WS_URL }}
  VITE_API_URL: ${{ secrets.VITE_API_URL }}
```

These get embedded into the built JavaScript at build time, so changes require a rebuild.

## Changing Backend URL Later

If you move the backend to a different VPS:

1. Update the secrets in GitHub:
   - `VITE_API_URL` → new API endpoint
   - `VITE_WS_URL` → new WebSocket endpoint
2. Push any change to `frontend/` (or manually trigger the workflow)
3. GitHub Actions will rebuild with the new endpoints

## Troubleshooting

**GitHub Actions fails to build:**
- Check the build logs in Actions tab for TypeScript errors
- Ensure Node.js version in workflow matches (currently v20)

**Frontend loads but API calls fail:**
- Verify `VITE_API_URL` and `VITE_WS_URL` are correct
- Check that backend is running and accessible from your location
- Test CORS headers: `curl -i https://your-api-url/api/auth/me`

**Page stuck on loading:**
- Open browser console (F12)
- Look for errors about missing API_URL or WS_URL secrets
- Verify secrets were created in GitHub repository settings
