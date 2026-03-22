# Seas of Strife - Backend Server Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd server
bun install
# or: npm install
```

### 2. Start PostgreSQL Locally

```bash
# From project root
docker-compose up -d

# Verify it's running
docker-compose ps
```

### 3. Initialize Database

```bash
cd server

# Run migration
bun run init-db

# Or with npm:
npm run init-db

# You should see:
# ✅ All expected tables created successfully!
# ✅ Database initialization complete!
```

### 4. Start Development Server

```bash
cd server
bun run dev

# Server starts on configured PORT (default: 3000)
```

---

## Environment Setup

### Local Development

Create a `.env.local` file (or `.env`):

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=seas_of_strife
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
PORT=3000
```

The server will auto-detect this on startup.

### Docker Compose Setup

All PostgreSQL credentials are in `docker-compose.yml`:
- User: `postgres`
- Password: `postgres`
- Database: `seas_of_strife`
- Port: `5432`

#### Common Docker Commands

```bash
# Start container
docker-compose up -d

# Stop container
docker-compose stop

# View logs
docker-compose logs -f postgres

# Connect to database
docker-compose exec postgres psql -U postgres -d seas_of_strife

# Remove container and data
docker-compose down -v
```

---

## Deploy to Railway

### 1. Create Railway Project

```bash
railway login
railway init
railway add  # Select PostgreSQL plugin
```

### 2. Set Environment

Railway automatically injects `DATABASE_URL` when PostgreSQL is added.

No manual `.env` needed!

### 3. Deploy Schema

```bash
cd server
railway run bun run init-db
```

### 4. Deploy Application

```bash
# Push to main branch (if configured for auto-deploy)
git push origin main

# Or manually:
railway up
```

Railway will automatically:
- Install dependencies (`bun install`)
- Run migrations if configured
- Start the server with `bun run index.ts`

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Login/authentication |
| `player_profiles` | Medal counts, game statistics |
| `games` | Full game state (JSONB) |
| `game_rounds` | Per-round scores |
| `game_results` | Final results (real players only) |
| `player_game_results` | Leaderboard entries |

### Schema Initialization

The schema is defined in `src/db/schema.ts` and includes:
- Primary keys and indexes
- Foreign key constraints
- JSONB columns for game state
- Timestamps for tracking

---

## Troubleshooting

### "Cannot connect to database"

```bash
# Check PostgreSQL is running
docker-compose ps

# View error logs
docker-compose logs postgres

# Restart container
docker-compose restart postgres
```

### "Migration failed"

```bash
# Check what tables exist
docker-compose exec postgres psql -U postgres -d seas_of_strife -c "\dt"

# Re-run migration
bun run init-db
```

### "PORT already in use"

```bash
# Change PORT in .env
PORT=3001

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### "bun command not found"

```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Or use npm instead
npm run init-db
npm run dev
```

---

## Development Workflow

1. **Create branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes** to code or schema

3. **If schema changed:**
   ```bash
   # Update src/db/schema.ts
   # Re-run locally
   bun run init-db
   
   # Test locally
   bun run dev
   
   # Schema will auto-deploy on Railway
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "my-feature: description"
   git push origin feature/my-feature
   ```

5. **Open PR** and merge to main
   - Railway auto-deploys on main push

---

## Next Steps

- [ ] Create HTTP API endpoints
- [ ] Add WebSocket support
- [ ] Implement authentication/login
- [ ] Create frontend (React/Vite)
- [ ] Set up CI/CD
