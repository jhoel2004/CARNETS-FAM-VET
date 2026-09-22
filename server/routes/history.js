const express = require('express');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.abs(parseInt(req.query.limit) || 300), 1000);
    const rows = await db.query('SELECT * FROM history ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/history error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, entity } = req.body;
    if (!action) return res.status(400).json({ error: 'Acción requerida' });

    const now = new Date();
    await db.run('INSERT INTO history (action, entity, "user", date, time) VALUES ($1, $2, $3, $4, $5)', [
      action, entity || '', req.user.name,
      now.toLocaleDateString('es-BO'), now.toLocaleTimeString('es-BO')
    ]);
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('POST /api/history error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
