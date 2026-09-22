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

    const id = p.id || 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const carnet = p.carnet_number || await nextCarnetNumber();
    const regDate = p.registration_date || new Date().toISOString().slice(0, 10);

    await db.run(`INSERT INTO pets (id, carnet_number, name, species, breed, sex, birth_date, color, weight,
      category, status, photo, fingerprint, offspring, registration_date,
      owner_name, owner_ci, owner_address, owner_city, owner_phone, owner_email,
      medical_vaccinated, medical_vaccines, medical_vet, medical_observations, medical_diseases, medical_allergies)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`, [
      id, carnet, p.name, p.species || 'perro', p.breed || '', p.sex || 'Macho',
      p.birth_date || '', p.color || '', p.weight || '', p.category || 'General',
      p.status || 'Activo', p.photo || '', p.fingerprint || '', p.offspring || '', regDate,
      p.owner_name, p.owner_ci || '', p.owner_address || '', p.owner_city || '', p.owner_phone, p.owner_email || '',
      p.medical_vaccinated || 'No', p.medical_vaccines || '', p.medical_vet || '',
      p.medical_observations || '', p.medical_diseases || '', p.medical_allergies || ''
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
    await db.run(`UPDATE pets SET
      name=$1, species=$2, breed=$3, sex=$4, birth_date=$5, color=$6, weight=$7, category=$8, status=$9,
      photo=$10, fingerprint=$11, offspring=$12, registration_date=$13,
      owner_name=$14, owner_ci=$15, owner_address=$16, owner_city=$17, owner_phone=$18, owner_email=$19,
      medical_vaccinated=$20, medical_vaccines=$21, medical_vet=$22, medical_observations=$23, medical_diseases=$24, medical_allergies=$25,
      updated_at=$26
      WHERE id=$27`, [
      p.name, p.species, p.breed, p.sex, p.birth_date, p.color, p.weight, p.category, p.status,
      p.photo, p.fingerprint, p.offspring || '', p.registration_date,
      p.owner_name, p.owner_ci, p.owner_address, p.owner_city, p.owner_phone, p.owner_email,
      p.medical_vaccinated, p.medical_vaccines, p.medical_vet, p.medical_observations, p.medical_diseases, p.medical_allergies,
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
  const row = await db.get("SELECT COUNT(*) as c FROM pets WHERE carnet_number LIKE $1", [`%${year}%`]);
  return `PLI-BO-${year}-${String((row ? parseInt(row.c) : 0) + 1).padStart(5, '0')}`;
}

module.exports = router;
