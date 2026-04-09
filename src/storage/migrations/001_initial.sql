-- src/storage/migrations/001_initial.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  preferences TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  last_seen TEXT
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id),
  claude_session_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  last_activity TEXT
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_args TEXT,
  tokens_used INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Memories table
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  category TEXT NOT NULL,
  subcategory TEXT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  importance REAL DEFAULT 0.5,
  confidence REAL DEFAULT 1.0,
  last_accessed TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, category, key)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  chat_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  action TEXT NOT NULL,
  args TEXT,
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_tasks(next_run) WHERE enabled = 1;
CREATE INDEX IF NOT EXISTS idx_sessions_chat ON sessions(chat_id);
