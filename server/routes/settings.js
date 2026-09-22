const express = require('express');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (e) {
    console.error('GET /api/settings error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body)) {
      await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [k, String(v)]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/settings error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
