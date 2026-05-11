import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'

const dbPath = join(app.getPath('userData'), 'library.db')
const dbDir = join(app.getPath('userData'))

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

export const db = new Database(dbPath)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS systems (
    name TEXT PRIMARY KEY,
    fullname TEXT,
    path TEXT,
    extension TEXT,
    platform TEXT,
    theme TEXT
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    system_name TEXT,
    path TEXT,
    name TEXT,
    desc TEXT,
    image TEXT,
    video TEXT,
    marquee TEXT,
    thumbnail TEXT,
    rating REAL,
    releasedate TEXT,
    developer TEXT,
    publisher TEXT,
    genre TEXT,
    players TEXT,
    favorite INTEGER DEFAULT 0,
    hidden INTEGER DEFAULT 0,
    fanart TEXT,
    wheel TEXT,
    titleshot TEXT,
    FOREIGN KEY(system_name) REFERENCES systems(name)
  );

  CREATE INDEX IF NOT EXISTS idx_games_system ON games(system_name);
  CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
`)

// Simple migration/force refresh: check if one of the new columns exists
try {
  db.prepare('SELECT marquee FROM games LIMIT 1').get()
} catch (e) {
  console.log('Database schema outdated or incomplete. Refreshing games table...')
  db.exec('DROP TABLE IF EXISTS games')
  // Re-run create
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      system_name TEXT,
      path TEXT,
      name TEXT,
      desc TEXT,
      image TEXT,
      video TEXT,
      marquee TEXT,
      thumbnail TEXT,
      rating REAL,
      releasedate TEXT,
      developer TEXT,
      publisher TEXT,
      genre TEXT,
      players TEXT,
      favorite INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      fanart TEXT,
      wheel TEXT,
      titleshot TEXT,
      FOREIGN KEY(system_name) REFERENCES systems(name)
    );
    CREATE INDEX IF NOT EXISTS idx_games_system ON games(system_name);
    CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
  `)
}
