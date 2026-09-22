/**
 * Migra datos desde SQLite local a Supabase PostgreSQL
 * Uso: npm run migrate
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.sqlite');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida. Agrega la variable de entorno con la URL de conexión de Supabase.');
    console.error('   Ejemplo: DATABASE_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres" npm run migrate');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ No se encontró la base de datos SQLite:', DB_PATH);
    process.exit(1);
  }

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const sqlite = new SQL.Database(buf);

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Conectado a SQLite y PostgreSQL');
    console.log('');

    await client.query('BEGIN');

    // Migrar users
    const users = sqlite.exec('SELECT * FROM users');
    if (users.length) {
      console.log(`📦 Migrando ${users[0].values.length} usuarios...`);
      for (const row of users[0].values) {
      const [id, username, password, role, name, created_at] = row;
        await client.query(
        `INSERT INTO users (id, username, password, role, name, created_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET username=$2, password=$3, role=$4, name=$5, created_at=$6`,
        [id, username, password, role, name, created_at]
      );
    }
      console.log('   ✅ Usuarios migrados');
    }

    // Migrar pets
    const pets = sqlite.exec('SELECT * FROM pets');
    if (pets.length) {
      console.log(`📦 Migrando ${pets[0].values.length} mascotas...`);
      for (const row of pets[0].values) {
        await client.query(
        `INSERT INTO pets (id, carnet_number, name, species, breed, sex, birth_date, color, weight,
          category, status, photo, fingerprint, offspring, registration_date,
          owner_name, owner_ci, owner_address, owner_city, owner_phone, owner_email,
          medical_vaccinated, medical_vaccines, medical_vet, medical_observations, medical_diseases, medical_allergies,
          created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
          ON CONFLICT (id) DO UPDATE SET carnet_number=$2, name=$3, species=$4, breed=$5, sex=$6, birth_date=$7, color=$8, weight=$9,
          category=$10, status=$11, photo=$12, fingerprint=$13, offspring=$14, registration_date=$15,
          owner_name=$16, owner_ci=$17, owner_address=$18, owner_city=$19, owner_phone=$20, owner_email=$21,
          medical_vaccinated=$22, medical_vaccines=$23, medical_vet=$24, medical_observations=$25, medical_diseases=$26, medical_allergies=$27,
          created_at=$28, updated_at=$29`,
        row
      );
    }
      console.log('   ✅ Mascotas migradas');
    }

    // Migrar settings
    const settings = sqlite.exec('SELECT * FROM settings');
    if (settings.length) {
      console.log(`📦 Migrando ${settings[0].values.length} configuraciones...`);
      for (const row of settings[0].values) {
      const [key, value] = row;
        await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, value]
      );
    }
      console.log('   ✅ Configuraciones migradas');
    }

    // Migrar history
    const history = sqlite.exec('SELECT * FROM history');
    if (history.length) {
      console.log(`📦 Migrando ${history[0].values.length} registros de historial...`);
      for (const row of history[0].values) {
      const [id, action, entity, user, date, time, created_at] = row;
        await client.query(
        `INSERT INTO history (id, action, entity, "user", date, time, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [id, action, entity, user, date, time, created_at]
      );
    }
      console.log('   ✅ Historial migrado');
    }

    // Actualizar secuencia de IDs
    console.log('🔄 Actualizando secuencias...');
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))");
    await client.query("SELECT setval(pg_get_serial_sequence('history', 'id'), COALESCE((SELECT MAX(id) FROM history), 1))");
    console.log('   ✅ Secuencias actualizadas');

    await client.query('COMMIT');
    console.log('');
    console.log('🎉 ¡Migración completada exitosamente!');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('❌ Error durante la migración:', e.message);
  process.exit(1);
});
