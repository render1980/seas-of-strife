# Seas of strife

Browser multiplayer game inspired by S.O.S (seas of strife) card board game.

## Local Development

### Prerequisites
- Docker and Docker Compose
- [Bun](https://bun.com/docs/installation)

### Install dependencies

```bash
cd server && bun install
```

### Start server

```bash
# 1. Start PostgreSQL
docker-compose up -d

cd server

# 2. Initialize schema
bun run scripts/init-db.ts
# Or `bun run init-db`

# 3. Start dev server
bun run dev
```

**Local connection details:** `postgresql://postgres:postgres@localhost:5432/seas_of_strife`

### Useful commands

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d seas_of_strife

# Verify tables
docker exec -it seas-of-strife-postgres-1 psql -U postgres -d seas_of_strife -c "\dt"

# Stop
docker-compose down

# Stop and wipe data
docker-compose down -v
```
