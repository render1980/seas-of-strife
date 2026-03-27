# Railway — Advanced Reference

For initial setup and common commands, see [DEPLOYMENT.md](DEPLOYMENT.md).

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

## Support

- **Railway Docs:** https://docs.railway.app
- **Troubleshooting:** https://docs.railway.app/troubleshooting
- **Status Page:** https://railway.statuspage.io
