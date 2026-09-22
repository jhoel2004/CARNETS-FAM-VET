-- ============================================
-- Pet Llama ID - Migración a Supabase PostgreSQL
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Operador',
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Compatibilidad con instalaciones que ejecutaron una versión anterior del esquema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Tabla de mascotas
CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  carnet_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'perro',
  breed TEXT DEFAULT '',
  sex TEXT DEFAULT 'Macho',
  birth_date TEXT DEFAULT '',
  color TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  status TEXT DEFAULT 'Activo',
  photo TEXT DEFAULT '',
  fingerprint TEXT DEFAULT '',
  offspring TEXT DEFAULT '',
  registration_date TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_ci TEXT DEFAULT '',
  owner_address TEXT DEFAULT '',
  owner_city TEXT DEFAULT '',
  owner_phone TEXT NOT NULL,
  owner_email TEXT DEFAULT '',
  medical_vaccinated TEXT DEFAULT 'No',
  medical_vaccines TEXT DEFAULT '',
  medical_vet TEXT DEFAULT '',
  medical_observations TEXT DEFAULT '',
  medical_diseases TEXT DEFAULT '',
  medical_allergies TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tabla de historial
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  "user" TEXT DEFAULT '',
  date TEXT DEFAULT '',
  time TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);
CREATE INDEX IF NOT EXISTS idx_pets_owner_ci ON pets(owner_ci);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pets_carnet_unique ON pets(carnet_number);
CREATE INDEX IF NOT EXISTS idx_pets_created_at ON pets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);

-- ============================================
-- Datos iniciales
-- ============================================

-- Admin user (usuario: admin, contraseña: admin123#$)
INSERT INTO users (username, password, role, name) VALUES
('admin', '$2a$10$BrrY/lLNj1jsjmaQ762OIuAWuLJBb3VDRq8NKoKC8pSgKbQYij7ci', 'Administrador', 'Administrador General')
ON CONFLICT (username) DO NOTHING;

-- Configuración por defecto
INSERT INTO settings (key, value) VALUES
('systemName', 'Pet Llama ID'),
('systemSub', 'Sistema Nacional de Identificación de Mascotas'),
('defaultTemplate', 'bolivia'),
('qrSize', '56'),
('cardFormat', 'CR80 (85.6 × 54 mm)'),
('footerText', 'Documento oficial de identificación animal — Bolivia'),
('signatureText', 'Jhoel')
ON CONFLICT (key) DO NOTHING;
