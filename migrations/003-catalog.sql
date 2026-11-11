-- ============================================================
-- 003: Catálogo dinámico de especies y razas
-- Idempotente: se puede ejecutar varias veces sin efecto.
-- Especies personalizadas (rama "Otro" del formulario) y razas
-- por especie (aplica a perro, gato y a cualquier especie nueva).
-- ============================================================

CREATE TABLE IF NOT EXISTS pet_species (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_breeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Evita duplicados (comparación insensible a mayúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_species_name ON pet_species (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_breeds_uniq ON pet_breeds (species, LOWER(name));

-- Especie concreta cuando la mascota pertenece al grupo "Otro"
-- (pets.species sigue siendo perro|gato|otro para las analíticas)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS species_detail TEXT DEFAULT '';

-- Atribución del usuario responsable de la mascota (1 usuario : N mascotas)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT '';
