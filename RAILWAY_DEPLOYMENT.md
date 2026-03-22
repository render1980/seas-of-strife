# Railway Deployment Guide

## Overview

Railway is a modern deployment platform that makes deploying full-stack apps simple. This guide covers deploying Seas of Strife to Railway.

---

## Prerequisites

1. **GitHub account** - Railway deploys from Git
2. **Railway account** - Sign up at https://railway.app
3. **Railway CLI** (optional but recommended)
   ```bash
   npm install -g @railway/cli
   # or
   brew install railway
   ```

---

## Step 1: Prepare Repository

### Ensure Git is Initialized

```bash
cd /path/to/seas-of-strife
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

### Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/seas-of-strife.git
git push -u origin main
```

---

## Step 2: Create Railway Project

### Option A: Via Railway Dashboard

1. Go to https://railway.app/dashboard
2. Click **"New Project"** → **"Deploy from GitHub"**
3. Authorize GitHub and select `seas-of-strife` repo
4. Railway will auto-detect the project

### Option B: Via Railway CLI

```bash
railway login
cd /path/to/seas-of-strife
railway init
```

Follow the prompts to select your GitHub repo.

---

## Step 3: Add PostgreSQL Plugin

### Via Dashboard

1. In Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway creates a PostgreSQL instance
3. `DATABASE_URL` is automatically injected into environment

### Via CLI

```bash
railway add
# Select: PostgreSQL
```

---

## Step 4: Deploy Schema

The schema is deployed automatically when the app starts, OR manually beforehand:

### Manual (Recommended)

```bash
# From project root
railway run bun server/scripts/init-db.ts

# Or if in server directory:
cd server
railway run bun run init-db
```

You should see output confirming all tables created.

### Automatic

The app can detect on startup if schema is missing and run initialization automatically (add this to `index.ts` later).

---

## Step 5: Configure Environment

### Database URL

Railway automatically sets `DATABASE_URL` when PostgreSQL is added.

**Verify in Railway Dashboard:**
1. Go to project
2. Click PostgreSQL service
3. Click **"Variables"** tab
4. You'll see `DATABASE_URL` = `postgresql://...`

### Additional Variables (if needed)

```bash
railway variables set PORT=3000
railway variables set NODE_ENV=production
```

---

## Step 6: Deploy Application

### Option A: Auto-Deploy from Git

1. Railway watches your `main` branch
2. Push changes to trigger auto-deploy:
   ```bash
   git add .
   git commit -m "Deploy to Railway"
   git push origin main
   ```
3. Railway builds and deploys automatically

### Option B: Manual Deploy

```bash
railway up
```

---

## Verify Deployment

### Check Build Logs

```bash
railway logs
```

You should see:
```
✅ Connection successful
✅ Schema deployed successfully
✅ All expected tables created successfully!
✅ Database initialization complete!
```

### Test Application

```bash
railway open
# Opens the deployed app URL in browser
```

### Connect to Database

```bash
railway connect postgres
# Opens psql prompt connected to Railway PostgreSQL

# Inside psql:
\dt   # List tables
SELECT * FROM users;
\q   # Quit
```

---

## Common Issues & Solutions

### Issue: "Cannot find module 'postgres'"

**Solution:** Dependencies aren't installed
```bash
railway run bun install
```

### Issue: "DATABASE_URL not found"

**Solution:** PostgreSQL plugin not added
```bash
# In Railway dashboard:
1. Click project
2. Click "+ New"
3. Select "Database" → "PostgreSQL"
4. Wait for it to initialize

# Re-deploy:
git push origin main
```

### Issue: "Schema not found" or table doesn't exist

**Solution:** Run init-db
```bash
railway run bun server/scripts/init-db.ts

# Or check logs:
railway logs
```

### Issue: "App crashes after deployment"

**Check logs:**
```bash
railway logs --follow
```

**Common causes:**
- PORT not set (Railway assigns `$PORT` env var)
- Database connection fails
- Missing dependencies

**Fix startup to use `$PORT`:**
```typescript
const port = process.env.PORT || 3000;
// Use port variable in server setup
```

---

## Environment Variables

Railway provides these automatically:

```bash
DATABASE_URL=postgresql://user:pass@host:port/db
PORT=8000  # Assigned by Railway
NODE_ENV=production
```

Set additional custom variables:

```bash
railway variables set CUSTOM_VAR=value
```

---

## Development vs Production

### Local Development

```bash
# .env file
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seas_of_strife
NODE_ENV=development
PORT=3000
```

```bash
cd server
bun run dev
```

### Railway Production

```bash
# Set in Railway Dashboard → Variables
NODE_ENV=production
# DATABASE_URL auto-set by PostgreSQL plugin
# PORT auto-set by Railway
```

### Differences

| Config | Local | Railway |
|--------|-------|---------|
| Database | Docker Compose | PostgreSQL Plugin |
| DATABASE_URL | Manual .env | Auto-injected |
| PORT | Your choice (3000) | Railway assigns |
| Logs | Terminal | Dashboard |
| Backup | Docker volume | Railway managed |

---

## Monitoring & Maintenance

### View Logs in Real-Time

```bash
railway logs --follow
```

### Monitor Resource Usage

Railway Dashboard → Project → Resources tab shows:
- CPU usage
- Memory usage
- Network I/O
- Deployment history

### View Database

```bash
railway connect postgres
# Browse data directly
```

### Manual Backups

```bash
# Export data from Railway PostgreSQL
railway run pg_dump $DATABASE_URL > backup.sql

# Later, restore:
railway run psql $DATABASE_URL < backup.sql
```

---

## Redeploy After Code Changes

### Automatic (Recommended)

```bash
git add .
git commit -m "Update feature"
git push origin main
# Railway deploys automatically
```

### Manual

```bash
railway redeploy
# or
railway up --force
```

---

## Scaling & Upgrades

### Increase Memory/CPU

Railway Dashboard → Project → PostgreSQL → Plan

Choose higher tier as needed.

### Add Environment Instances

```bash
railway add
# Select "Node.js" or similar for additional server instances
```

---

## Delete Project

```bash
# Via CLI
railway down --force

# Via Dashboard
Project Settings → Danger Zone → Delete Project
```

---

## Next Steps

1. ✅ Set up Railway project with PostgreSQL
2. ✅ Deploy schema
3. ⏳ Implement HTTP/WebSocket API endpoints
4. ⏳ Add authentication
5. ⏳ Test end-to-end
6. ⏳ Deploy frontend

---

## Support

- **Railway Docs:** https://docs.railway.app
- **Troubleshooting:** https://docs.railway.app/troubleshooting
- **Status Page:** https://railway.statuspage.io
