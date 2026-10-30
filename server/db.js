const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.sqlite');
let usePg = false;
let pool = null;
let sqlJsDb = null;

// Estado de la conexión, expuesto para /api/health y el diagnóstico en producción.
const state = { ready: false, error: null, host: null };

function setError(e) {
  state.ready = false;
  state.error = (e && e.code ? `${e.code}: ` : '') + (e && e.message ? e.message : String(e));
}

async function init() {
  if (process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_URL;
    const { Pool } = require('pg');
    try {
      state.host = new URL(raw).host || 'host desconocido';
    } catch {
      state.error = 'DATABASE_URL inválida: debe ser postgresql://usuario:contraseña@host:5432/postgres — sin comillas ni espacios, con el placeholder [YOUR-PASSWORD] reemplazado y los símbolos de la contraseña URL-encoded (@=%40 #=%23 $=%24)';
      console.error('[DB]', state.error);
      throw new Error('Invalid DATABASE_URL format');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000
    });
    pool.on('error', (e) => {
      console.error('[DB] Error del pool:', (e && e.code ? `${e.code}: ` : '') + (e && e.message ? e.message : e));
    });
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        await ensurePgSchema(client);
      } finally {
        client.release();
      }
      state.ready = true;
      state.error = null;
      console.log(`[DB] Conectado a PostgreSQL (${state.host})`);
    } catch (e) {
      setError(e);
      throw e;
    }
    usePg = true;
  } else {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      sqlJsDb = new SQL.Database(buf);
    } else {
      sqlJsDb = new SQL.Database();
    }
    sqlJsDb.run('PRAGMA journal_mode = WAL');
    await createSqliteTables();
    console.log('[DB] Conectado a SQLite local:', DB_PATH);
    state.ready = true;
    state.error = null;
    usePg = false;
  }
}

async function close() {
  if (pool) {
    const p = pool;
    pool = null;
    try { await p.end(); } catch (_) {}
  }
}

async function createSqliteTables() {
  sqlJsDb.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Operador',
    name TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  sqlJsDb.run(`CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    carnet_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    species TEXT DEFAULT 'perro',
    breed TEXT DEFAULT '',
    sex TEXT DEFAULT 'Macho',
    birth_date TEXT DEFAULT '',
    color TEXT DEFAULT '',
    weight TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'Activo',
    photo TEXT DEFAULT '',
    fingerprint TEXT DEFAULT '',
    offspring TEXT DEFAULT '',
    registration_date TEXT DEFAULT (date('now','localtime')),
    owner_name TEXT NOT NULL,
    owner_ci TEXT DEFAULT '',
    owner_address TEXT DEFAULT '',
    owner_city TEXT DEFAULT '',
    owner_phone TEXT DEFAULT '',
    owner_email TEXT DEFAULT '',
    medical_vaccinated TEXT DEFAULT 'No',
    medical_vaccines TEXT DEFAULT '',
    medical_vet TEXT DEFAULT '',
    medical_observations TEXT DEFAULT '',
    medical_diseases TEXT DEFAULT '',
    medical_allergies TEXT DEFAULT '',
    signature TEXT DEFAULT '',
    age_years TEXT DEFAULT '',
    age_months TEXT DEFAULT '',
    distinctive_marks TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  sqlJsDb.run(`CREATE TABLE IF NOT EXISTS pet_health_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    type TEXT DEFAULT 'historial',
    title TEXT NOT NULL,
    record_date TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    applied INTEGER DEFAULT 0,
    next_due TEXT DEFAULT '',
    vet TEXT DEFAULT '',
    product TEXT DEFAULT '',
    weight TEXT DEFAULT '',
    applied_at TEXT DEFAULT (datetime('now','localtime')),
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  sqlJsDb.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  sqlJsDb.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity TEXT DEFAULT '',
    user TEXT DEFAULT '',
    date TEXT DEFAULT '',
    time TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Add new columns to existing tables if missing
  const addCol = (table, col) => {
    try { sqlJsDb.run(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch (_) {}
  };
  addCol('pets', "signature TEXT DEFAULT ''");
  addCol('pets', "age_years TEXT DEFAULT ''");
  addCol('pets', "age_months TEXT DEFAULT ''");
  addCol('pets', "distinctive_marks TEXT DEFAULT ''");

  // Seed admin user if not exists
  const adminExists = sqlJsDb.exec("SELECT id FROM users WHERE username = 'admin'");
  if (!adminExists.length || !adminExists[0].values.length) {
    const hash = bcrypt.hashSync('admin123#$', 10);
    sqlJsDb.run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", ['admin', hash, 'Administrador', 'Administrador']);
  }
  // Seed settings
  const nameExists = sqlJsDb.exec("SELECT key FROM settings WHERE key = 'system_name'");
  if (!nameExists.length || !nameExists[0].values.length) {
    sqlJsDb.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ['system_name', 'FAM J VET']);
  }
  save();
}

// Convierte "$1, $2, $3" a "?, ?, ?" para sql.js
function toSqlite(sql, params) {
  if (usePg) return { sql, params };
  let idx = 0;
  const converted = sql.replace(/\$\d+/g, () => params[idx++] !== undefined ? '?' : '?');
  return { sql: converted, params };
}

async function query(sql, params = []) {
  if (usePg) {
    const result = await pool.query(sql, params);
    return result.rows;
  }
  const { sql: s, params: p } = toSqlite(sql, params);
  const stmt = sqlJsDb.prepare(s);
  if (p.length) stmt.bind(p);
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push(row);
  }
  stmt.free();
  return rows;
}

async function get(sql, params = []) {
  if (usePg) {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  }
  const { sql: s, params: p } = toSqlite(sql, params);
  const stmt = sqlJsDb.prepare(s);
  if (p.length) stmt.bind(p);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

async function run(sql, params = []) {
  if (usePg) {
    return await pool.query(sql, params);
  }
  const { sql: s, params: p } = toSqlite(sql, params);
  sqlJsDb.run(s, p);
  save();
  return { changes: sqlJsDb.getRowsModified() };
}

function save() {
  if (!usePg && sqlJsDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const data = sqlJsDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// Asegura esquema de carnet sanitario en PostgreSQL (Supabase) al iniciar.
async function ensurePgSchema(client) {
  await client.query(`
    ALTER TABLE IF EXISTS pets ADD COLUMN IF NOT EXISTS distinctive_marks TEXT DEFAULT '';
    CREATE TABLE IF NOT EXISTS pet_health_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'historial',
      title TEXT NOT NULL,
      record_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      applied INTEGER DEFAULT 0,
      next_due TEXT DEFAULT '',
      vet TEXT DEFAULT '',
      product TEXT DEFAULT '',
      weight TEXT DEFAULT '',
      applied_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pet_health_records_pet_id ON pet_health_records(pet_id);
    CREATE INDEX IF NOT EXISTS idx_pet_health_records_type ON pet_health_records(type);
    CREATE INDEX IF NOT EXISTS idx_pet_health_records_date ON pet_health_records(record_date DESC);
  `);
  for (const [key, value] of [
    ['healthTagline', 'Amor, cuidado y salud para toda la vida'],
    ['healthServices', 'Control sanitario · Vacunación · Desparasitación · Historial clínico'],
    ['healthMotto', 'Porque su bienestar es nuestra prioridad'],
    ['healthCardWidth', '100'],
    ['healthCardHeight', '155'],
    ['systemName', 'FAM J VET'],
    ['systemSub', 'Sistema Nacional de Identificación de Mascotas'],
    ['defaultTemplate', 'bolivia'],
    ['cardFormat', 'CR80 (85.6 × 54 mm)']
  ]) {
    await client.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }
  console.log('[DB] Esquema de carnet sanitario verificado');
}

module.exports = { init, close, query, get, run, state };
