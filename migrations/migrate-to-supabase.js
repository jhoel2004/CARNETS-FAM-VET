/**
 * Crea el esquema en PostgreSQL (Supabase) si falta y migra los datos
 * de la base SQLite local (data/db.sqlite) a Supabase.
 *
 * Uso (desde la carpeta del proyecto):
 *   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-us-west-2.pooler.supabase.com:5432/postgres" npm run migrate
 *
 * Es idempotente: puede ejecutarse varias veces sin duplicar datos.
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.sqlite');

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'Operador',
  name TEXT,
  created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE TABLE IF NOT EXISTS pets (
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
  registration_date TEXT DEFAULT to_char(current_date, 'YYYY-MM-DD'),
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
  created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  "user" TEXT DEFAULT '',
  date TEXT DEFAULT '',
  time TEXT DEFAULT '',
  created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
`;

// Por si la tabla pets ya existía en una versión antigua sin las columnas nuevas.
const DDL_PATCH = `
ALTER TABLE pets ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
ALTER TABLE pets ADD COLUMN IF NOT EXISTS age_years TEXT DEFAULT '';
ALTER TABLE pets ADD COLUMN IF NOT EXISTS age_months TEXT DEFAULT '';
`;

const CONFLICT = {
  users: { key: 'id', mode: 'update' },
  pets: { key: 'id', mode: 'update' },
  settings: { key: 'key', mode: 'update' },
  history: { key: 'id', mode: 'nothing' }
};

function quote(col) {
  return `"${col}"`;
}

async function migrateTable(client, sqlite, table) {
  const res = sqlite.exec(`SELECT * FROM ${table}`);
  if (!res.length || !res[0].values.length) {
    console.log(`   (sin filas en ${table})`);
    return 0;
  }
  const { columns, values } = res[0];
  const names = columns.map(quote);
  const ph = columns.map((c, i) => `$${i + 1}`);
  let sql = `INSERT INTO ${table} (${names.join(', ')}) VALUES (${ph.join(', ')})`;
  const cf = CONFLICT[table];
  if (cf) {
    if (cf.mode === 'update') {
      const sets = columns.map((c, i) => (c === cf.key ? null : `${quote(c)}=$${i + 1}`))
        .filter(Boolean).join(', ');
      sql += ` ON CONFLICT (${quote(cf.key)}) DO UPDATE SET ${sets}`;
    } else {
      sql += ` ON CONFLICT (${quote(cf.key)}) DO NOTHING`;
    }
  }
  for (const row of values) {
    await client.query(sql, row);
  }
  console.log(`   ${table}: ${values.length} filas migradas`);
  return values.length;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[ERROR] DATABASE_URL no está definida.');
    console.error('  Ejemplo (copiado tal cual de Render > Environment, o de Supabase > Connection string):');
    console.error('  DATABASE_URL="postgresql://...@aws-1-us-west-2.pooler.supabase.com:5432/postgres" npm run migrate');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR] No se encontró la base SQLite local: ${DB_PATH}`);
    process.exit(1);
  }

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database(fs.readFileSync(DB_PATH));

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 3
  });

  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[OK] Conectado a SQLite local y a PostgreSQL (Supabase)');
    console.log('');

    console.log('Creando/verificando esquema...');
    await client.query(DDL);
    await client.query(DDL_PATCH);
    console.log('[OK] Esquema listo (users, pets, settings, history)');
    console.log('');

    await client.query('BEGIN');
    const total = {};
    try {
      for (const table of ['users', 'pets', 'settings', 'history']) {
        total[table] = await migrateTable(client, sqlite, table);
      }
      await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))");
      await client.query("SELECT setval(pg_get_serial_sequence('history', 'id'), COALESCE((SELECT MAX(id) FROM history), 1))");
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    }

    console.log('');
    console.log('Conteo final en PostgreSQL:');
    for (const table of ['users', 'pets', 'settings', 'history']) {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      console.log(`   ${table}: ${r.rows[0].n}`);
    }
    console.log('');
    console.log('[OK] Migración completada. Redeploy de Render no es necesario: la app lee la DB en vivo.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  const msg = e && e.code ? `${e.code}: ${e.message}` : (e && e.message ? e.message : String(e));
  console.error('[ERROR] Migración falló:', msg);
  process.exit(1);
});
