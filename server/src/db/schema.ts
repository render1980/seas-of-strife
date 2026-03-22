/**
 * Database schema for Seas of Strife.
 * Run this on initial setup to create all tables.
 */

const schema = `
-- Users table for login/authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player profile/statistics
CREATE TABLE IF NOT EXISTS player_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  gold_medals INTEGER DEFAULT 0,
  silver_medals INTEGER DEFAULT 0,
  bronze_medals INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active and completed games
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  game_id INTEGER UNIQUE NOT NULL,
  game_state JSONB NOT NULL,
  phase VARCHAR(50) NOT NULL,
  current_round INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups by game_id
CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);
CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);

-- Round results (one per round per game)
CREATE TABLE IF NOT EXISTS game_rounds (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  player_scores JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_game_id ON game_rounds(game_id);

-- Final game results (only for real players, excludes bots)
CREATE TABLE IF NOT EXISTS game_results (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  real_player_ids JSONB NOT NULL,
  winners JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON game_results(game_id);

-- Player game participation (for leaderboards and profiles)
CREATE TABLE IF NOT EXISTS player_game_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL,
  medal VARCHAR(10),
  total_tricks_taken INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_game_results_user_id ON player_game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_player_game_results_game_id ON player_game_results(game_id);
`;

export { schema };
