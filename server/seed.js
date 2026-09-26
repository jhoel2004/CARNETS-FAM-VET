require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  await db.ready;

  const existing = db.get('SELECT COUNT(*) as c FROM users');
  if (existing && existing.c > 0) {
    console.log('La base de datos ya tiene datos. Omitiendo seed.');
    return;
  }

  const hash = bcrypt.hashSync('admin123', 10);
  db.run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['admin', hash, 'Administrador', 'Administrador General']);

  const hash2 = bcrypt.hashSync('operador123', 10);
  db.run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['operador', hash2, 'Operador', 'Operador de Registro']);

  const defaults = {
    systemName: 'FAM-VET',
    systemSub: 'Sistema Nacional de Identificación de Mascotas',
    defaultTemplate: 'bolivia',
    qrSize: '56',
    cardFormat: 'CR80 (85.6 × 54 mm)',
    footerText: 'Documento oficial de identificación animal — Bolivia',
    signatureText: 'Jhoel',
    language: 'es'
  };

  const stmt = db.get('SELECT COUNT(*) as c FROM settings');
  if (!stmt || stmt.c === 0) {
    for (const [k, v] of Object.entries(defaults)) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
    }
  }

  console.log('Seed completado: usuarios y configuración por defecto creados.');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = seed;
