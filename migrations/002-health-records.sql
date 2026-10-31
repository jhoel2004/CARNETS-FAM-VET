-- ============================================
-- FAM J VET - Carnet Sanitario: registros de salud
-- Ejecutar en SQL Editor de Supabase o con npm run migrate:health
-- ============================================

-- Nueva columna en mascotas para señas distintivas / color más detalle
ALTER TABLE pets ADD COLUMN IF NOT EXISTS distinctive_marks TEXT DEFAULT '';

-- Tabla de registros de salud (vacunas, desparasitaciones, historial clínico)
CREATE TABLE IF NOT EXISTS pet_health_records (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'historial',
  title TEXT NOT NULL,
  record_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  applied INTEGER DEFAULT 0,
  next_due TEXT DEFAULT '',
  vet TEXT DEFAULT '',
  product TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  batch TEXT DEFAULT '',
  scheduled_date TEXT DEFAULT '',
  applied_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Compatibilidad con instalaciones que crearon la tabla antes de estos campos.
ALTER TABLE pet_health_records ADD COLUMN IF NOT EXISTS batch TEXT DEFAULT '';
ALTER TABLE pet_health_records ADD COLUMN IF NOT EXISTS scheduled_date TEXT DEFAULT '';

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pet_health_records_pet_id ON pet_health_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_health_records_type ON pet_health_records(type);
CREATE INDEX IF NOT EXISTS idx_pet_health_records_date ON pet_health_records(record_date DESC);

-- Configuración por defecto del carnet sanitario (si no existe)
INSERT INTO settings (key, value) VALUES
('healthTagline', 'Amor, cuidado y salud para toda la vida'),
('healthServices', 'Control sanitario · Vacunación · Desparasitación · Historial clínico'),
('healthMotto', 'Porque su bienestar es nuestra prioridad'),
('healthCardWidth', '100'),
('healthCardHeight', '155')
ON CONFLICT (key) DO NOTHING;

-- Configuración general si falta (compatibilidad con instalaciones viejas)
INSERT INTO settings (key, value) VALUES
('systemName', 'FAM J VET'),
('systemSub', 'Sistema Nacional de Identificación de Mascotas'),
('defaultTemplate', 'bolivia'),
('cardFormat', 'CR80 (85.6 × 54 mm)')
ON CONFLICT (key) DO NOTHING;
