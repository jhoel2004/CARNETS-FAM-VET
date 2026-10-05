const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const publicPetColumns = 'id, carnet_number, name, species, breed, sex, birth_date, color, weight, category, status, photo, fingerprint, offspring, registration_date, owner_name, owner_phone, medical_vaccinated, medical_vaccines, medical_vet, medical_observations, medical_allergies';

// ============================================
// RUTAS PÚBLICAS PRIMERO (antes de /:id)
// ============================================

router.get('/public/carnet/:carnet', async (req, res) => {
  try {
    const pet = await db.get(`SELECT ${publicPetColumns} FROM pets WHERE carnet_number = $1`, [req.params.carnet]);
    if (!pet) return res.status(404).json({ error: 'No encontrada' });
    res.json(pet);
  } catch (e) {
    console.error('GET /api/pets/public/carnet error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/public/:id', async (req, res) => {
  try {
    const pet = await db.get(`SELECT ${publicPetColumns} FROM pets WHERE id = $1`, [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'No encontrada' });
    res.json(pet);
  } catch (e) {
    console.error('GET /api/pets/public/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// RUTAS AUTENTICADAS
// ============================================

router.get('/', authenticateToken, async (req, res) => {
  try {
    let sql = 'SELECT * FROM pets';
    const params = [];
    if (req.user.role === 'Espectador') {
      sql += ' WHERE owner_ci = $1';
      params.push(req.user.username);
    }
    sql += ' ORDER BY created_at DESC';
    const pets = await db.query(sql, params);
    res.json(pets);
  } catch (e) {
    console.error('GET /api/pets error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pet = await db.get('SELECT * FROM pets WHERE id = $1', [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada' });
    if (req.user.role !== 'Administrador' && pet.owner_ci !== req.user.username) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    res.json(pet);
  } catch (e) {
    console.error('GET /api/pets/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const p = req.body;
    if (!p.name || !p.owner_name || !p.owner_phone)
      return res.status(400).json({ error: 'Nombre, propietario y teléfono son requeridos' });

    if (!p.carnet_number || !String(p.carnet_number).trim())
      return res.status(400).json({ error: 'El número de carnet/CI es requerido' });

    const dupCheck = await db.get('SELECT id FROM pets WHERE carnet_number = $1', [String(p.carnet_number).trim()]);
    if (dupCheck && dupCheck.id !== p.id)
      return res.status(409).json({ error: 'El número de carnet/CI ya existe' });

    const id = p.id || 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const regDate = p.registration_date || new Date().toISOString().slice(0, 10);
    const carnet = String(p.carnet_number).trim();

    await db.run(`INSERT INTO pets (id, carnet_number, name, species, breed, sex, birth_date, color, weight,
      category, status, photo, fingerprint, offspring, registration_date,
      owner_name, owner_ci, owner_address, owner_city, owner_phone, owner_email,
      medical_vaccinated, medical_vaccines, medical_vet, medical_observations, medical_diseases, medical_allergies,
      signature, age_years, age_months)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`, [
      id, carnet, p.name, p.species || 'perro', p.breed || '', p.sex || 'Macho',
      p.birth_date || '', p.color || '', p.weight || '', p.category || 'General',
      p.status || 'Activo', p.photo || '', p.fingerprint || '', p.offspring || '', regDate,
      p.owner_name, p.owner_ci || '', p.owner_address || '', p.owner_city || '', p.owner_phone, p.owner_email || '',
      p.medical_vaccinated || 'No', p.medical_vaccines || '', p.medical_vet || '',
      p.medical_observations || '', p.medical_diseases || '', p.medical_allergies || '',
      p.signature || '', p.age_years || '', p.age_months || ''
    ]);

    // Auto-crear espectador con password = CI
    if (p.owner_ci) {
      const existing = await db.get('SELECT id FROM users WHERE username = $1', [p.owner_ci]);
      if (!existing) {
        const hash = bcrypt.hashSync(p.owner_ci, 10);
        await db.run('INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4)',
          [p.owner_ci, hash, 'Espectador', p.owner_name || p.owner_ci]);
      }
    }

    res.status(201).json({ id, carnet_number: carnet });
  } catch (e) {
    console.error('POST /api/pets error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM pets WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Mascota no encontrada' });

    const p = req.body;

    if (p.carnet_number && String(p.carnet_number).trim() !== existing.carnet_number) {
      const dupCheck = await db.get('SELECT id FROM pets WHERE carnet_number = $1 AND id != $2', [String(p.carnet_number).trim(), req.params.id]);
      if (dupCheck) return res.status(409).json({ error: 'El número de carnet/CI ya existe' });
    }

    await db.run(`UPDATE pets SET
      carnet_number=$1, name=$2, species=$3, breed=$4, sex=$5, birth_date=$6, color=$7, weight=$8, category=$9, status=$10,
      photo=$11, fingerprint=$12, offspring=$13, registration_date=$14,
      owner_name=$15, owner_ci=$16, owner_address=$17, owner_city=$18, owner_phone=$19, owner_email=$20,
      medical_vaccinated=$21, medical_vaccines=$22, medical_vet=$23, medical_observations=$24, medical_diseases=$25, medical_allergies=$26,
      signature=$27, age_years=$28, age_months=$29,
      updated_at=$30
      WHERE id=$31`, [
      p.carnet_number || existing.carnet_number, p.name, p.species, p.breed, p.sex, p.birth_date, p.color, p.weight, p.category, p.status,
      p.photo, p.fingerprint, p.offspring || '', p.registration_date,
      p.owner_name, p.owner_ci, p.owner_address, p.owner_city, p.owner_phone, p.owner_email,
      p.medical_vaccinated, p.medical_vaccines, p.medical_vet, p.medical_observations, p.medical_diseases, p.medical_allergies,
      p.signature || '', p.age_years || '', p.age_months || '',
      new Date().toISOString(), req.params.id
    ]);

    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/pets/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM pets WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Mascota no encontrada' });
    await db.run('DELETE FROM pets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/pets/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

async function nextCarnetNumber() {
  const year = new Date().getFullYear();
  const rows = await db.query("SELECT carnet_number FROM pets WHERE carnet_number LIKE $1", [`PLI-BO-${year}-%`]);
  let max = 0;
  for (const r of rows) {
    const num = parseInt(String(r.carnet_number).split('-').pop(), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return `PLI-BO-${year}-${String(max + 1).padStart(5, '0')}`;
}

module.exports = router;
