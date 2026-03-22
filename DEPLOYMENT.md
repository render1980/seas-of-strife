# Local Development & Deployment Setup

## Local PostgreSQL Setup

### Prerequisites
- Docker and Docker Compose installed

### Start PostgreSQL Locally

```bash
# Start PostgreSQL container
docker-compose up -d
```

**Connection details:**
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `seas_of_strife`

### Stop PostgreSQL

```bash
# Keep data volume
docker-compose down  # Data persists in postgres_data volume

# Remove all data
docker-compose down -v
```

### Connect to Database

```bash
# Using psql (if installed)
psql -h localhost -U postgres -d seas_of_strife

# Using Docker
docker-compose exec postgres psql -U postgres -d seas_of_strife
```

---

## Deploy Schema Locally

### 1. Start PostgreSQL
```bash
docker-compose up -d
```

### 2. Run Migration Script
```bash
# From server directory
cd server

# Initialize database
bun run scripts/init-db.ts

# Or using npm (if bun not available)
npm run init-db
```

This will:
- Connect to PostgreSQL
- Create all tables (users, player_profiles, games, game_rounds, game_results, player_game_results)
- Create indexes
- Verify schema integrity

---

## Deploy to Railway

### Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed
- Git repository initialized

### 1. Create Railway Project

```bash
# Login to Railway
railway login

# Create new project
railway init

# Link a PostgreSQL plugin
railway add
# Select: PostgreSQL
```

### 2. Set Environment Variables

```bash
# In Railway dashboard or via CLI:
railway variables set DATABASE_URL="your-railway-postgresql-url"

# Or let Railway auto-generate DATABASE_URL when you add PostgreSQL plugin
```

### 3. Deploy Schema

```bash
# Deploy migration to Railway
railway run bun run scripts/init-db.ts

# Or directly:
railway run bun server/scripts/init-db.ts
```

### 4. Verify Deployment

```bash
# Check Railway dashboard for logs
# Or query database:
railway connect postgres
\dt  # List all tables
\q   # Quit
```

---

## Environment Configuration

### Local Development

Create `.env.local`:
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=seas_of_strife
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
```

Or use Docker Compose URL:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seas_of_strife
```

### Railway Production

Railway automatically injects `DATABASE_URL` when PostgreSQL plugin is added.

No additional setup needed — the app reads `DATABASE_URL` from environment.

---

## Troubleshooting

### "Connection refused" on localhost:5432
```bash
# Verify container is running
docker-compose ps

# Start it
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### "Database does not exist"
```bash
# Re-run initialization
railway run bun run scripts/init-db.ts

# Or locally:
bun run scripts/init-db.ts
```

### Railway deployment fails
- Check Railway logs: `railway logs`
- Verify `DATABASE_URL` is set: `railway variables`
- Ensure PostgreSQL plugin is added to project
