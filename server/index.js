require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:3000'];

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"]
    }
  }
}));
// CORS: acepta la lista configurada Y siempre el mismo origen del servicio.
// Así el login nunca se rompe aunque ALLOWED_ORIGINS quede desactualizado en el host.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const sameHost = (() => {
    if (!origin) return false;
    try { return new URL(origin).host === (req.headers.host || '').split(',')[0]; }
    catch { return false; }
  })();
  const allowed = !origin || allowedOrigins.includes(origin) || sameHost;
  if (allowed) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      return res.sendStatus(204);
    }
    return next();
  }
  return res.status(403).json({ error: 'Origen no permitido por CORS' });
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intente de nuevo más tarde' }
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '..', 'public')));

const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const settingsRoutes = require('./routes/settings');
const historyRoutes = require('./routes/history');
const userRoutes = require('./routes/users');

// Health check primero: responde siempre, esté lista la DB o no (así Render no devuelve 503).
app.get('/api/health', (req, res) => {
  const st = db.state;
  res.json({
    status: 'ok',
    db: st.ready ? 'ok' : 'error',
    dbError: st.ready ? null : st.error,
    timestamp: new Date().toISOString()
  });
});

// Si la base de datos no está lista, las rutas API responden 503 con mensaje claro en vez de 500 genérico.
app.use('/api', (req, res, next) => {
  if (!db.state.ready) {
    return res.status(503).json({ error: 'Base de datos no disponible', dbError: db.state.error });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/users', userRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// El servidor escucha primero y la base de datos se conecta en segundo plano:
// la app queda disponible aunque la DB tarde o falle (con reintentos con backoff).
async function start() {
  app.listen(PORT, () => {
    console.log(`FAM J VET corriendo en http://localhost:${PORT}`);
  });
  let intento = 0;
  for (;;) {
    intento++;
    try {
      await db.init();
      return;
    } catch (e) {
      console.error(`[DB] No se pudo conectar (intento ${intento}):`, (e && e.message) || e);
      await db.close();
      await delay(Math.min(30000, 5000 * intento));
    }
  }
}

start().catch(e => { console.error('Error al iniciar:', e); process.exit(1); });
