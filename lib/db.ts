import initSqlJs, { Database } from 'sql.js'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.sqlite')
const WASM_PATH = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

let db: Database | null = null

async function getDb(): Promise<Database> {
  if (db) return db

  const wasmBinary = fs.readFileSync(WASM_PATH).buffer as ArrayBuffer
  const SQL = await initSqlJs({ wasmBinary })

  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  initSchema(db)
  persistDb()

  return db
}

function initSchema(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS npcs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profession TEXT,
      age INTEGER,
      city TEXT,
      lat REAL,
      lng REAL,
      traits TEXT,
      friends TEXT,
      base_energy INTEGER DEFAULT 75,
      base_social INTEGER DEFAULT 50,
      budget_ron INTEGER DEFAULT 3000,
      system_prompt TEXT
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      final_state TEXT,
      all_events TEXT,
      created_at INTEGER,
      UNIQUE(npc_id, day)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS generated_stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      stage TEXT NOT NULL,
      story_text TEXT,
      created_at INTEGER,
      UNIQUE(npc_id, day, stage)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS llm_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      stage TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      UNIQUE(npc_id, day, stage)
    )
  `)
}

export function persistDb() {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  fs.writeFileSync(DB_PATH, buffer)
}

export { getDb }
