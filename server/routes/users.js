const express = require('express');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.query('SELECT id, username, role, name FROM users');
    res.json(users);
  } catch (e) {
    console.error('GET /api/users error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    const existing = await db.get('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) return res.status(409).json({ error: 'El usuario ya existe' });

    const hash = bcrypt.hashSync(password, 10);
    await db.run('INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4)',
      [username, hash, role || 'Operador', name || username]);
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('POST /api/users error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const count = await db.get('SELECT COUNT(*) as c FROM users');
    if (!count || parseInt(count.c) <= 1) return res.status(400).json({ error: 'Debe existir al menos un usuario' });
    await db.run('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/users/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
