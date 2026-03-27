# Deployment

## Railway Deployment

### Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed
- Git repository initialized

### First-time setup

```bash
npm install -g @railway/cli    # Install CLI
railway login
railway init                   # Link to GitHub repo
railway add                    # Select: PostgreSQL
railway variables set DATABASE_URL="your-railway-postgresql-url" # Or let Railway auto-generate DATABASE_URL when you add PostgreSQL plugin
railway run bun server/scripts/init-db.ts  # Deploy schema
railway connect postgres # Verify connection to db
git push origin main           # First deploy
```

### Ongoing deploys

```bash
git add . && git commit -m "..." && git push origin main
# Railway auto-deploys from main branch
```

### Common commands

| Task | Command |
|------|---------|
| View logs | `railway logs --follow` |
| Open app | `railway open` |
| Connect to DB | `railway connect postgres` |
| View env vars | `railway variables` |
| Set env var | `railway variables set KEY=value` |
| Force redeploy | `railway redeploy` |

For monitoring, backups, and scaling see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md).
