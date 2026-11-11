const express = require('express');
const db = require('../db');
const { authenticateToken, requireAdminOrOperator } = require('../middleware/auth');

const router = express.Router();

// Normaliza el nombre: sin espacios de más y en minúsculas para comparar.
const norm = (s) => String(s || '').trim().toLowerCase();

/* ============ ESPECIES PERSONALIZADAS (rama "Otro") ============ */

router.get('/species', authenticateToken, async (req, res) => {
  try {
    const rows = await db.query('SELECT id, name FROM pet_species ORDER BY name ASC');
    res.json(rows);
  } catch (e) {
    console.error('GET /api/catalog/species error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/species', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre de la especie es requerido' });
    if (name.length > 60) return res.status(400).json({ error: 'Nombre demasiado largo (máx. 60)' });

    const existing = await db.query('SELECT id, name FROM pet_species');
    if (existing.some(r => norm(r.name) === norm(name))) {
      return res.status(409).json({ error: 'Esa especie ya existe' });
    }

    const id = 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await db.run('INSERT INTO pet_species (id, name) VALUES ($1, $2)', [id, name]);
    res.status(201).json({ id, name });
  } catch (e) {
    console.error('POST /api/catalog/species error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ============ RAZAS POR ESPECIE ============ */

router.get('/breeds', authenticateToken, async (req, res) => {
  try {
    const species = String(req.query.species || '').trim().toLowerCase();
    let rows;
    if (species) {
      rows = await db.query('SELECT id, name, species FROM pet_breeds WHERE species = $1 ORDER BY name ASC', [species]);
    } else {
      rows = await db.query('SELECT id, name, species FROM pet_breeds ORDER BY name ASC');
    }
    res.json(rows);
  } catch (e) {
    console.error('GET /api/catalog/breeds error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/breeds', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const species = String(req.body.species || '').trim().toLowerCase();
    if (!name || !species) return res.status(400).json({ error: 'Nombre y especie son requeridos' });
    if (name.length > 60) return res.status(400).json({ error: 'Nombre demasiado largo (máx. 60)' });

    const existing = await db.query('SELECT name, species FROM pet_breeds WHERE species = $1', [species]);
    if (existing.some(r => norm(r.name) === norm(name))) {
      return res.status(409).json({ error: 'Esa raza ya existe para la especie' });
    }

    const id = 'br' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await db.run('INSERT INTO pet_breeds (id, name, species) VALUES ($1, $2, $3)', [id, name, species]);
    res.status(201).json({ id, name, species });
  } catch (e) {
    console.error('POST /api/catalog/breeds error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
