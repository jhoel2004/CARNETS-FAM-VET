#!/usr/bin/env node
/**
 * Aplica el esquema de registros de salud (pet_health_records)
 * y la columna distinctive_marks en pets.
 *
 * Es idempotente: puede ejecutarse varias veces sin duplicar datos.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npm run migrate:health
 *
 * Si no se define DATABASE_URL, se aplica sobre la base SQLite local.
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, '..', 'data', 'db.sqlite');

const DDL = [
  `ALTER TABLE pets ADD COLUMN distinctive_marks TEXT DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS pet_health_records (
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
    batch TEXT DEFAULT '',
    scheduled_date TEXT DEFAULT '',
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE pet_health_records ADD COLUMN batch TEXT DEFAULT ''`,
  `ALTER TABLE pet_health_records ADD COLUMN scheduled_date TEXT DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS idx_pet_health_records_pet_id ON pet_health_records(pet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pet_health_records_type ON pet_health_records(type)`,
  `CREATE INDEX IF NOT EXISTS idx_pet_health_records_date ON pet_health_records(record_date DESC)`,
];

const SETTINGS = [
  ['healthTagline', 'Amor, cuidado y salud para toda la vida'],
  ['healthServices', 'Control sanitario · Vacunación · Desparasitación · Historial clínico'],
  ['healthMotto', 'Porque su bienestar es nuestra prioridad'],
  ['healthCardWidth', '100'],
  ['healthCardHeight', '155'],
  ['systemName', 'FAM J VET'],
  ['systemSub', 'Sistema Nacional de Identificación de Mascotas'],
  ['defaultTemplate', 'bolivia'],
  ['cardFormat', 'CR80 (85.6 × 54 mm)'],
];

async function main() {
  const pgUrl = process.env.DATABASE_URL;

  if (pgUrl) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: pgUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      max: 3,
    });
    const client = await pool.connect();
    try {
      for (const sql of DDL) {
        await client.query(sql);
        console.log('[OK] Ejecutado:', sql.split('\n')[0].trim().slice(0, 80));
      }
      for (const [key, value] of SETTINGS) {
        await client.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          [key, value]
        );
      }
      console.log('[OK] Configuración de carnet sanitario verificada');

      const counts = {};
      for (const t of ['pets', 'pet_health_records', 'settings']) {
        const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
        counts[t] = r.rows[0].n;
      }
      console.log('[OK] Conteo final en PostgreSQL:', JSON.stringify(counts));
    } finally {
      client.release();
      await pool.end();
    }
    console.log('[OK] Migración de carnet sanitario completada.');
    return;
  }

  // Sin DATABASE_URL: aplicar sobre SQLite local
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (!fs.existsSync(dbPath)) {
    console.error(`[ERROR] No se encontró la base SQLite local: ${dbPath}`);
    process.exit(1);
  }
  const sqlite = new SQL.Database(fs.readFileSync(dbPath));

  // Ejecutar todo el DDL como un bloque (sql.js maneja mejor las sentencias en lote)
  try {
    sqlite.exec(DDL.join('\n'));
    DDL.forEach((s) => console.log('[OK] Ejecutado:', s.split('\n')[0].trim().slice(0, 80)));
  } catch (e) {
    console.warn('[WARN] DDL bloque ->', e.message);
    // Fallback: ejecutar sentencia por sentencia con run() (compatible con sql.js)
    for (const sql of DDL) {
      try {
        sqlite.run(sql);
        console.log('[OK] Ejecutado:', sql.split('\n')[0].trim().slice(0, 80));
      } catch (e2) {
        console.warn('[WARN]', sql.split('\n')[0].trim().slice(0, 80), '->', e2.message);
      }
    }
  }
  for (const [key, value] of SETTINGS) {
    try {
      sqlite.run(
        'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    } catch (e) {
      console.warn('[WARN] setting', key, e.message);
    }
  }
  const data = sqlite.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('[OK] Migración de carnet sanitario completada en SQLite local.');
}

main().catch((e) => {
  const msg = e && e.code ? `${e.code}: ${e.message}` : (e && e.message ? e.message : String(e));
  console.error('[ERROR] Migración falló:', msg);
  process.exit(1);
});
