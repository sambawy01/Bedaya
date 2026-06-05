# Bedaya deploy — Vercel (client) + Railway (server) + Vercel Postgres

Two-platform split. Client is a static Vite SPA on Vercel; server is the long-running Express app on Railway; Postgres is provisioned via Vercel Storage and consumed by Railway over the public connection string.

## 0. One-time CLI logins

In your terminal (or via `!` in this session):

```bash
vercel login    # opens browser
railway login   # opens browser
```

## 1. Provision Vercel Postgres

```bash
# From repo root, in a Vercel-linked context:
cd client
vercel link        # pick or create the Bedaya project
vercel storage create postgres --name bedaya-db
vercel env pull .env.production.local   # grabs POSTGRES_URL etc.
```

Copy the `POSTGRES_URL` value out — Railway needs it as `DATABASE_URL`. Note: the **non-pooled** URL is what we want for migrations; the pooled URL is fine for runtime.

Then migrate the schema against that DB:

```bash
cd ../server
DATABASE_URL='<paste-postgres-url>' NODE_ENV=production npm run migrate
```

## 2. Deploy server to Railway

```bash
cd server
railway init       # name it "bedaya-server"
railway variables set DATABASE_URL='<paste-postgres-url>' \
                      ANTHROPIC_API_KEY='<your-key>' \
                      AI_PROVIDER='claude' \
                      NODE_ENV='production' \
                      ALLOWED_ORIGINS='https://bedaya.vercel.app'
railway up
railway domain     # generate a public URL — copy it
```

The generated URL looks like `bedaya-server-production.up.railway.app`. Save it for step 3.

## 3. Deploy client to Vercel

```bash
cd ../client
vercel env add VITE_API_BASE production
# paste the Railway URL (no trailing slash): https://bedaya-server-production.up.railway.app
vercel --prod
```

Output gives you the Vercel URL (e.g. `bedaya.vercel.app`). If it differs from what you set in `ALLOWED_ORIGINS`, update Railway:

```bash
cd ../server
railway variables set ALLOWED_ORIGINS='https://<actual-vercel-domain>'
railway up
```

## 4. Smoke test production

```bash
curl https://<railway-domain>/api/health
# expect {"success":true,"data":{"status":"ok",...}}

# Then open https://<vercel-domain> in a browser and complete signup → lesson flow.
```

## Re-deploys

- **Client changes:** `cd client && vercel --prod`
- **Server changes:** `cd server && railway up`
- **Schema changes:** edit `server/src/db/schema.sql`, then `DATABASE_URL='<prod-url>' npm run migrate` before deploying the server

## Env var reference

### Client (Vercel)
| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE` | `https://<railway-domain>` | Baked in at build time |

### Server (Railway)
| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Vercel Postgres URL | Use the non-pooled URL for migrations, pooled is fine at runtime |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Required when `AI_PROVIDER=claude` |
| `AI_PROVIDER` | `claude` or `ollama` | Default `claude` |
| `NODE_ENV` | `production` | Enables SSL on pg pool |
| `ALLOWED_ORIGINS` | `https://<vercel-domain>` | Comma-separated for multiple |
| `PORT` | (set by Railway) | Don't override |
