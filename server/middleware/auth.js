const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'pet-llama-id-secure-secret-2024');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es requerido en producción');
}

function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Token requerido' });

  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'Administrador')
    return res.status(403).json({ error: 'Se requiere rol de Administrador' });
  next();
}

module.exports = { authenticateToken, requireAdmin };
