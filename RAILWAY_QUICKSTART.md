# Railway Quickstart

**TL;DR for deploying Seas of Strife to Railway:**

## 1. First Time Setup (5 min)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Go to project directory
cd /path/to/seas-of-strife

# Create Railway project from Git
railway init

# Add PostgreSQL database
railway add
# Select: PostgreSQL
# Wait for it to initialize (~30s)

# Deploy schema to Railway PostgreSQL
railway run bun server/scripts/init-db.ts
```

✅ You're done! Railway auto-deploys on git push.

---

## 2. Deploy Updates (30 seconds)

```bash
git add .
git commit -m "Your changes"
git push origin main

# That's it! Railway watches and deploys automatically
```

To check deployment status:
```bash
railway logs --follow
```

---

## 3. Connect to Production Database

```bash
# View DATABASE_URL
railway variables

# Connect with psql
railway connect postgres

# Or export schema locally (backup)
railway run pg_dump $DATABASE_URL > backup.sql
```

---

## 4. Environment Variables

Set custom variables:
```bash
railway variables set KEY=value
railway variables set PORT=3000
railway variables set NODE_ENV=production
```

`DATABASE_URL` is auto-set by PostgreSQL plugin.

---

## 5. Redeploy If Needed

```bash
# Force full redeploy
railway redeploy

# Or just push to git
git push --force origin main
```

---

## Common Commands

| Task | Command |
|------|---------|
| View logs | `railway logs --follow` |
| Set variable | `railway variables set KEY=value` |
| View env | `railway variables` |
| Connect to DB | `railway connect postgres` |
| See status | `railway status` |
| Open app | `railway open` |
| Manual deploy | `railway up` |
| Force redeploy | `railway redeploy` |

---

## Troubleshooting

**App crashes after deploy?**
```bash
railway logs --follow
# Check for errors in output
```

**Can't connect to database?**
```bash
# Verify PostgreSQL is running
railway status

# Run init-db manually
railway run bun server/scripts/init-db.ts
```

**DATABASE_URL not found?**
```bash
# Check variables
railway variables

# If not there, add PostgreSQL plugin:
railway add  # Select PostgreSQL
```

---

## Details

For full Railway documentation, see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)
