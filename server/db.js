const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.sqlite');
let usePg = false;
let pool = null;
let sqlJsDb = null;

async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('✅ Conectado a PostgreSQL');
    } finally {
      client.release();
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
    console.log('✅ Conectado a SQLite local:', DB_PATH);
    usePg = false;
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

  // Seed admin user if not exists
  const adminExists = sqlJsDb.exec("SELECT id FROM users WHERE username = 'admin'");
  if (!adminExists.length || !adminExists[0].values.length) {
    const hash = bcrypt.hashSync('admin123#$', 10);
    sqlJsDb.run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", ['admin', hash, 'Administrador', 'Administrador']);
  }
  // Seed settings
  const nameExists = sqlJsDb.exec("SELECT key FROM settings WHERE key = 'system_name'");
  if (!nameExists.length || !nameExists[0].values.length) {
    sqlJsDb.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ['system_name', 'FAM-VET']);
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

module.exports = { init, query, get, run };
