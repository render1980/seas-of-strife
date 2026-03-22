# Deployment Checklist

Complete this checklist to move from local development to Railway production.

---

## Phase 1: Local Development Setup ✅

- [ ] Clone repository
- [ ] `cd server && bun install`
- [ ] `docker-compose up -d` (PostgreSQL starts)
- [ ] `bun run init-db` (schema created locally)
- [ ] `bun run dev` (dev server running on http://localhost:3000)
- [ ] Verify tables in PostgreSQL:
  ```bash
  docker exec -it seas-of-strife-postgres-1 psql -U postgres -d seas_of_strife -c "\dt"
  ```
  Should show: games, game_rounds, game_results, player_game_results, users, player_profiles

---

## Phase 2: Git Repository Setup

- [ ] Repository initialized: `git init` (if not already)
- [ ] Remote configured: `git remote -v` shows origin → GitHub
- [ ] All code committed: `git add . && git commit -m "Initial commit"`
- [ ] Pushed to GitHub: `git push origin main`
- [ ] GitHub repository is **public** (or Railway can access private via OAuth)

**GitHub URL:** `https://github.com/YOUR_USERNAME/seas-of-strife`

---

## Phase 3: Railway Account & CLI

- [ ] Created Railway account at https://railway.app ✅
- [ ] Installed Railway CLI: `npm install -g @railway/cli`
- [ ] Logged in: `railway login`
  - Opens browser for GitHub OAuth
  - Verify in terminal that login succeeded
- [ ] `railway` command works: `railway --version`

---

## Phase 4: Create Railway Project

**Option A: Via CLI (Recommended)**
- [ ] `cd /path/to/seas-of-strife`
- [ ] `railway init`
- [ ] Select "Deploy from GitHub"
- [ ] Authorize and select your repository
- [ ] Confirm project created

**Option B: Via Dashboard**
- [ ] Go to https://railway.app/dashboard
- [ ] Click "New Project" → "Deploy from GitHub"
- [ ] Authorize and select repository
- [ ] Confirm project created

**After creation, you should see:**
- [ ] Project named "seas-of-strife" in dashboard
- [ ] GitHub branch set to `main`

---

## Phase 5: Add PostgreSQL Database

**Via CLI:**
- [ ] `railway add`
- [ ] Select "PostgreSQL"
- [ ] Wait for initialization (~30 seconds)
- [ ] Verify with `railway status`

**Via Dashboard:**
- [ ] Click project
- [ ] Click "+ New"
- [ ] Select "Database" → "PostgreSQL"
- [ ] Wait for initialization

**After adding PostgreSQL, you should see:**
- [ ] PostgreSQL service in project
- [ ] `DATABASE_URL` in Variables tab
- [ ] Connection is working (no errors in logs)

---

## Phase 6: Deploy Schema

**Method 1: Manual (Recommended for first deploy)**
```bash
cd server
railway run bun run init-db
```

Expected output:
```
✅ Connected to PostgreSQL
✅ Running schema creation...
✅ All expected tables created successfully!
```

- [ ] Schema deployment succeeded
- [ ] All 6 tables created (verify with `railway run psql $DATABASE_URL -c "\dt"`)

**Method 2: Automatic (add to app startup)**
- [ ] Modify `server/src/db/connection.ts` to auto-initialize on connect
- [ ] (Optional - manual approach is safer for production)

---

## Phase 7: Environment Variables

**Verify auto-injected:**
```bash
railway variables
```

Should show (at minimum):
- [ ] `DATABASE_URL` = `postgresql://...`

**Set additional variables (if needed):**
```bash
railway variables set PORT=3000
railway variables set NODE_ENV=production
```

- [ ] All needed env variables are set

---

## Phase 8: Configure Deployment

Verify `railroad.json` exists and is correct:

```bash
cat server/railroad.json
```

Should contain:
- [ ] `builder`: "nixpacks"
- [ ] `startCommand`: "bun run index.ts"
- [ ] `restartPolicy`: "on_failure, max_retries = 5"

---

## Phase 9: Initial Deployment

**Option 1: Push to GitHub (Auto-deploy)**
```bash
git add .
git commit -m "Update for Railway deployment"
git push origin main
```
- [ ] Changes pushed to GitHub `main` branch
- [ ] Railway automatically starts deployment (watch in dashboard)

**Option 2: Manual Deploy**
```bash
railway up
```
- [ ] Deployment triggered manually

**Monitor deployment:**
```bash
railway logs --follow
```

- [ ] Build succeeds (no errors)
- [ ] App starts successfully
- [ ] Database connection succeeds

---

## Phase 10: Verify Production Deployment

**Check application is running:**
```bash
railway open
# Opens: https://seas-of-strife-prod.railway.app (or similar)
```

- [ ] App responds (should show API response or welcome page)

**If API not implemented yet:**
- [ ] Server starts without errors
- [ ] Logs show successful DB connection

**Test database connection:**
```bash
railway connect postgres
```

Then in psql:
```sql
\dt   # List tables
SELECT COUNT(*) FROM users;  # Should return 0
\q
```

- [ ] PostgreSQL accessible
- [ ] Tables exist on Railway
- [ ] No data in tables (fresh deployment)

---

## Phase 11: Ongoing Development

**Local development cycle:**
1. Make changes locally
2. Test with `docker-compose` and `bun run dev`
3. Commit: `git add . && git commit -m "message"`
4. Push: `git push origin main`
5. Railway auto-deploys

- [ ] First change successfully deployed
- [ ] Auto-deploy working correctly

**To view logs anytime:**
```bash
railway logs --follow
```

---

## Phase 12: Data Persistence Test

**Optional but recommended:**
1. Deploy game to Railway and play a round
2. Check that data was saved:
   ```bash
   railway connect postgres
   SELECT * FROM games LIMIT 1;
   ```
3. Verify `game_state` column contains JSON data

- [ ] Game state persists to Railway PostgreSQL
- [ ] Full end-to-end working

---

## Rollback / Troubleshooting

**If deployment fails:**
- [ ] Check logs: `railway logs --follow`
- [ ] Common issues:
  - [ ] Port not configured (add `PORT=3000` to variables)
  - [ ] DATABASE_URL missing (ensure PostgreSQL plugin added)
  - [ ] Dependencies missing (run `bun install` locally first)

**To rollback to previous version:**
```bash
railway redeploy --input=<previous-deployment-id>
```

Or push previous commit:
```bash
git revert HEAD
git push origin main
```

- [ ] (If needed) Rollback tested and working

---

## Final Checks

- [ ] Local development works: `bun run dev`
- [ ] PostgreSQL plugin added to Railway
- [ ] Schema deployed to Railway: `railway run bun run init-db`
- [ ] Changes auto-deploy on `git push origin main`
- [ ] Production app responds: `railway open`
- [ ] Logs accessible: `railway logs --follow`
- [ ] Database accessible: `railway connect postgres`

---

## You're Deployed! 🚀

**Next Steps:**
1. Implement HTTP API endpoints (Phase 5)
2. Add WebSocket support for real-time updates
3. Build frontend with React + Vite
4. Add authentication system
5. Run comprehensive testing

**Deployment Status:**
- Local: ✅ Running on http://localhost:3000
- Production: ✅ Running on Railway (see URL via `railway open`)
- Database: ✅ PostgreSQL on Railway, backups managed by Railway

**Documentation:**
- Local setup: See [SERVER_SETUP.md](SERVER_SETUP.md)
- Railway detailed: See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)
- Railway quick ref: See [RAILWAY_QUICKSTART.md](RAILWAY_QUICKSTART.md)
