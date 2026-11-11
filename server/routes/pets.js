const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireAdmin, requireAdminOrOperator } = require('../middleware/auth');

const router = express.Router();
const publicPetColumns = 'id, carnet_number, name, species, species_detail, breed, sex, birth_date, color, distinctive_marks, weight, category, status, photo, registration_date, owner_name, owner_phone, medical_vaccinated, medical_vaccines, medical_vet, medical_observations, medical_allergies, chip, has_chip';

// ============================================
// CI/CARNET SECUENCIAL AUTOMÁTICO (PLI-BO-AAAA-NNNNN)
// El contador por año vive en settings (carnetSeq_AAAA) y se siembra con
// el máximo de los números ya existentes para no repetir ni saltarse historia.
// El prefijo es configurable (settings: carnetPrefix, por defecto PLI-BO).
// ============================================
const CARNET_PREFIX_DEFAULT = 'PLI-BO';

async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  await db.run('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
}

// Calcula el próximo número libre SIN consumirlo (vista previa del formulario).
async function peekNextCarnet() {
  const prefix = (String((await getSetting('carnetPrefix')) || '').trim().toUpperCase()) || CARNET_PREFIX_DEFAULT;
  const year = new Date().getFullYear();
  const seqKey = `carnetSeq_${year}`;
  let seq = Number(await getSetting(seqKey)) || 0;
  if (!seq) {
    // Primer uso del año: sembrar el contador con el máximo ya asignado
    const rows = await db.query('SELECT carnet_number FROM pets WHERE carnet_number LIKE $1', [`${prefix}-${year}-%`]);
    for (const r of rows) {
      const m = String(r.carnet_number || '').match(/(\d+)\s*$/);
      if (m) seq = Math.max(seq, parseInt(m[1], 10));
    }
  }
  let candidate = '';
  do {
    seq += 1;
    candidate = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  } while (await db.get('SELECT id FROM pets WHERE carnet_number = $1', [candidate]));
  return { candidate, seq, seqKey };
}

// Genera y reserva el próximo número (avanza el contador en settings).
async function nextCarnetNumber() {
  const { candidate, seq, seqKey } = await peekNextCarnet();
  await setSetting(seqKey, seq);
  return candidate;
}

function parseDetailList(value) {
  try {
    const list = JSON.parse(value || '[]');
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

// Las versiones anteriores guardaban vacunas dentro de pet_medical_details,
// mientras que el carnet sanitario usa pet_health_records. Unimos ambas
// fuentes para que ningún historial ya registrado desaparezca del carnet.
async function getHealthRecordsForPet(petId) {
  const rows = await db.query(
    'SELECT * FROM pet_health_records WHERE pet_id = $1 ORDER BY record_date DESC, created_at DESC',
    [petId]
  );
  const details = await db.get(
    'SELECT vaccines_detail, deworming_detail, conditions_detail FROM pet_medical_details WHERE pet_id = $1',
    [petId]
  );

  const addLegacyRecords = (items, type, prefix, titlePrefix = '') => {
    items.forEach((item, index) => {
      const name = String(item && item.name || '').trim();
      const title = `${titlePrefix}${name}`;
      const recordDate = String(item && item.date || '');
      if (!name) return;
      const duplicate = rows.some(row => row.type === type && row.title === title && String(row.record_date || '') === recordDate);
      if (!duplicate) {
        rows.push({
          id: `${prefix}-${petId}-${index}`,
          pet_id: petId,
          type,
          title,
          record_date: recordDate,
          notes: '',
          applied: 1,
          next_due: '',
          vet: '',
          product: '',
          weight: '',
          batch: '',
          scheduled_date: '',
          source: 'medical_details'
        });
      }
    });
  };

  if (details) {
    addLegacyRecords(parseDetailList(details.vaccines_detail), 'vacuna', 'medical-vaccine');
    addLegacyRecords(parseDetailList(details.deworming_detail), 'desparasitacion', 'medical-deworming');
    addLegacyRecords(parseDetailList(details.conditions_detail), 'historial', 'medical-condition', 'Enfermedad crónica: ');
  }
  return rows.sort((a, b) => String(b.record_date || '').localeCompare(String(a.record_date || '')));
}

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

// Buscar propietarios existentes por CI o teléfono (para autocompletar)
router.get('/owners/search', authenticateToken, async (req, res) => {
  try {
    const ci = (req.query.ci || '').trim();
    const phone = (req.query.phone || '').trim();
    if (!ci && !phone) return res.json([]);
    let sql = 'SELECT DISTINCT owner_name, owner_ci, owner_phone, owner_email, owner_city, owner_address FROM pets WHERE 1=1';
    const params = [];
    if (ci) { sql += ' AND owner_ci = $' + (params.length + 1); params.push(ci); }
    if (phone) { sql += ' AND owner_phone = $' + (params.length + 1); params.push(phone); }
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/pets/owners/search error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// Próximo CI/carnet secuencial disponible (vista previa; NO consume el número)
router.get('/next-carnet', authenticateToken, async (req, res) => {
  try {
    const { candidate } = await peekNextCarnet();
    res.json({ carnet_number: candidate });
  } catch (e) {
    console.error('GET /api/pets/next-carnet error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

// Datos consolidados para el panel administrativo. Evita una consulta médica por mascota.
router.get('/analytics', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const [medicalDetails, healthRecords] = await Promise.all([
      db.query('SELECT pet_id, sterilized, microchip, blood_type, vaccines_detail, deworming_detail, conditions_detail, surgeries_detail, medications_detail FROM pet_medical_details'),
      db.query('SELECT pet_id, type, title, record_date, applied, next_due, vet, product, weight FROM pet_health_records')
    ]);
    res.json({ medicalDetails, healthRecords });
  } catch (e) {
    console.error('GET /api/pets/analytics error:', e);
    res.status(500).json({ error: 'No se pudieron cargar las analíticas' });
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

    // CI/carnet: si el cliente no lo envía (modo automático) el servidor genera
    // el siguiente secuencial único; si viene a mano (check Personalizar),
    // debe ser único (409 si se repite).
    let carnet = String(p.carnet_number || '').trim();
    if (carnet) {
      const dupCheck = await db.get('SELECT id FROM pets WHERE carnet_number = $1', [carnet]);
      if (dupCheck && dupCheck.id !== p.id)
        return res.status(409).json({ error: 'El número de carnet/CI ya existe' });
    } else {
      let generated = '';
      for (let i = 0; i < 3 && !generated; i++) {
        const candidate = await nextCarnetNumber();
        const taken = await db.get('SELECT id FROM pets WHERE carnet_number = $1', [candidate]);
        if (!taken) generated = candidate;
      }
      if (!generated) return res.status(500).json({ error: 'No se pudo generar un número de carnet único' });
      carnet = generated;
    }

    const id = p.id || 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const regDate = p.registration_date || new Date().toISOString().slice(0, 10);

    // Usuario responsable (1 usuario : N mascotas). Si se indica created_by
    // debe existir en users; si no existe o falta, se usa quien registra.
    let createdBy = String(p.created_by || '').trim();
    if (createdBy) {
      const userExists = await db.get('SELECT id FROM users WHERE username = $1', [createdBy]);
      if (!userExists) createdBy = '';
    }
    if (!createdBy) createdBy = req.user.username || '';

    await db.run(`INSERT INTO pets (id, carnet_number, ci_number, name, species, breed, sex, birth_date, color, distinctive_marks, weight,
      category, status, photo, registration_date,
      owner_name, owner_ci, owner_address, owner_city, owner_phone, owner_email,
      medical_vaccinated, medical_vaccines, medical_vet, medical_observations, medical_diseases, medical_allergies,
      signature, age_years, age_months, chip, has_chip, paw_photo, created_by, species_detail)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)`, [
      id, carnet, carnet, p.name, p.species || 'perro', p.breed || '', p.sex || 'Macho',
      p.birth_date || '', p.color || '', p.distinctive_marks || '', p.weight || '', p.category || 'General',
      p.status || 'Activo', p.photo || '', regDate,
      p.owner_name, p.owner_ci || '', p.owner_address || '', p.owner_city || '', p.owner_phone, p.owner_email || '',
      p.medical_vaccinated || 'No', p.medical_vaccines || '', p.medical_vet || '',
      p.medical_observations || '', p.medical_diseases || '', p.medical_allergies || '',
      p.signature || '', p.age_years || '', p.age_months || '',
      p.chip || '', p.has_chip ? 1 : 0, p.paw_photo || '',
      createdBy, String(p.species_detail || '').trim().toLowerCase()
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

    if (p.carnet_number && String(p.carnet_number).trim() !== existing.carnet_number) {
      const dupCheck = await db.get('SELECT id FROM pets WHERE carnet_number = $1 AND id != $2', [String(p.carnet_number).trim(), req.params.id]);
      if (dupCheck) return res.status(409).json({ error: 'El número de carnet/CI ya existe' });
    }

    const hasChip = p.has_chip !== undefined ? (p.has_chip ? 1 : 0) : (existing.has_chip ? 1 : 0);

    // Permite actualizaciones parciales: cualquier campo ausente conserva el valor previo.
    const v = (value, fallback = '') => value === undefined ? fallback : value;

    // Si el CI llega vacío se conserva el existente (nunca se pierde el número).
    // ci_number (registro secuencial) se mantiene igual al carnet_number.
    const finalCarnet = String(v(p.carnet_number, existing.carnet_number) || existing.carnet_number || '').trim();

    await db.run(`UPDATE pets SET
      carnet_number=$1, ci_number=$2, name=$3, species=$4, breed=$5, sex=$6, birth_date=$7, color=$8, distinctive_marks=$9, weight=$10, category=$11, status=$12,
      photo=$13, registration_date=$14,
      owner_name=$15, owner_ci=$16, owner_address=$17, owner_city=$18, owner_phone=$19, owner_email=$20,
      medical_vaccinated=$21, medical_vaccines=$22, medical_vet=$23, medical_observations=$24, medical_diseases=$25, medical_allergies=$26,
      signature=$27, age_years=$28, age_months=$29,
      chip=$30, has_chip=$31, paw_photo=$32,
      created_by=$33, species_detail=$34, updated_at=$35
      WHERE id=$36`, [
      finalCarnet, finalCarnet,
      v(p.name, existing.name), v(p.species, existing.species), v(p.breed, existing.breed), v(p.sex, existing.sex), v(p.birth_date, existing.birth_date), v(p.color, existing.color), v(p.distinctive_marks, existing.distinctive_marks), v(p.weight, existing.weight), v(p.category, existing.category || 'General'), v(p.status, existing.status || 'Activo'),
      v(p.photo, existing.photo), v(p.registration_date, existing.registration_date),
      v(p.owner_name, existing.owner_name), v(p.owner_ci, existing.owner_ci), v(p.owner_address, existing.owner_address), v(p.owner_city, existing.owner_city), v(p.owner_phone, existing.owner_phone), v(p.owner_email, existing.owner_email),
      v(p.medical_vaccinated, existing.medical_vaccinated), v(p.medical_vaccines, existing.medical_vaccines), v(p.medical_vet, existing.medical_vet), v(p.medical_observations, existing.medical_observations), v(p.medical_diseases, existing.medical_diseases), v(p.medical_allergies, existing.medical_allergies),
      v(p.signature, existing.signature), v(p.age_years, existing.age_years), v(p.age_months, existing.age_months),
      p.chip !== undefined ? p.chip : existing.chip, hasChip,
      p.paw_photo !== undefined ? p.paw_photo : existing.paw_photo,
      v(p.created_by, existing.created_by),
      v(p.species_detail, existing.species_detail),
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

// ============================================
// ENDPOINTS DE REGISTROS DE SALUD (carnet sanitario)
// ============================================

// Listar registros de salud de una mascota (autenticado)
router.get('/:id/health-records', authenticateToken, async (req, res) => {
  try {
    const pet = await db.get('SELECT id, owner_ci FROM pets WHERE id = $1', [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada' });
    if (req.user.role === 'Espectador' && pet.owner_ci !== req.user.username) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const rows = await getHealthRecordsForPet(req.params.id);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/pets/:id/health-records error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear registro de salud
router.post('/:id/health-records', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const pet = await db.get('SELECT id FROM pets WHERE id = $1', [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada' });

    const p = req.body;
    if (!p.type || !p.title) {
      return res.status(400).json({ error: 'Tipo y título son requeridos' });
    }
    const validTypes = ['vacuna', 'desparasitacion', 'historial'];
    if (!validTypes.includes(p.type)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    const id = 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();
    const applied = p.applied ? 1 : 0;
    const appliedAt = applied ? now : null;

    await db.run(`INSERT INTO pet_health_records (
      id, pet_id, type, title, record_date, notes, applied, next_due, vet, product, weight, batch, scheduled_date, applied_at, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [
      id, req.params.id, p.type, p.title, p.record_date || '', p.notes || '', applied,
      p.next_due || '', p.vet || '', p.product || '', p.weight || '', p.batch || '', p.scheduled_date || '', appliedAt, now, now
    ]);

    await db.run('INSERT INTO history (action, entity, "user", date, time) VALUES ($1,$2,$3,$4,$5)', [
      'Registro de salud', `${p.title} (${p.type})`, req.user.name,
      new Date().toLocaleDateString('es-BO'), new Date().toLocaleTimeString('es-BO')
    ]);

    res.status(201).json({ id, success: true });
  } catch (e) {
    console.error('POST /api/pets/:id/health-records error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Editar registro de salud
router.put('/health-records/:id', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM pet_health_records WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });

    const p = req.body;
    const validTypes = ['vacuna', 'desparasitacion', 'historial'];
    if (p.type && !validTypes.includes(p.type)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    const now = new Date().toISOString();
    let applied = existing.applied;
    let appliedAt = existing.applied_at;
    if (p.applied !== undefined) {
      applied = p.applied ? 1 : 0;
      appliedAt = applied ? now : null;
    }

    await db.run(`UPDATE pet_health_records SET
      type=$1, title=$2, record_date=$3, notes=$4, applied=$5, next_due=$6, vet=$7, product=$8, weight=$9, batch=$10, scheduled_date=$11,
      applied_at=$12, updated_at=$13
      WHERE id=$14`, [
      p.type || existing.type, p.title || existing.title, p.record_date !== undefined ? p.record_date : existing.record_date,
      p.notes !== undefined ? p.notes : existing.notes, applied,
      p.next_due !== undefined ? p.next_due : existing.next_due,
      p.vet !== undefined ? p.vet : existing.vet,
      p.product !== undefined ? p.product : existing.product,
      p.weight !== undefined ? p.weight : existing.weight,
      p.batch !== undefined ? p.batch : existing.batch,
      p.scheduled_date !== undefined ? p.scheduled_date : existing.scheduled_date,
      appliedAt, now, req.params.id
    ]);

    await db.run('INSERT INTO history (action, entity, "user", date, time) VALUES ($1,$2,$3,$4,$5)', [
      'Edición de registro de salud', existing.title, req.user.name,
      new Date().toLocaleDateString('es-BO'), new Date().toLocaleTimeString('es-BO')
    ]);

    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/health-records/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Marcar / desmarcar registro como aplicado
router.patch('/health-records/:id/apply', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM pet_health_records WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });

    const applied = req.body.applied !== false;
    const now = new Date().toISOString();
    await db.run('UPDATE pet_health_records SET applied = $1, applied_at = $2, updated_at = $3 WHERE id = $4', [
      applied ? 1 : 0, applied ? now : null, now, req.params.id
    ]);

    await db.run('INSERT INTO history (action, entity, "user", date, time) VALUES ($1,$2,$3,$4,$5)', [
      applied ? 'Vacuna aplicada' : 'Registro desmarcado', existing.title, req.user.name,
      new Date().toLocaleDateString('es-BO'), new Date().toLocaleTimeString('es-BO')
    ]);

    res.json({ success: true, applied });
  } catch (e) {
    console.error('PATCH /api/health-records/:id/apply error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar registro de salud
router.delete('/health-records/:id', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM pet_health_records WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    await db.run('DELETE FROM pet_health_records WHERE id = $1', [req.params.id]);
    await db.run('INSERT INTO history (action, entity, "user", date, time) VALUES ($1,$2,$3,$4,$5)', [
      'Eliminación de registro de salud', existing.title, req.user.name,
      new Date().toLocaleDateString('es-BO'), new Date().toLocaleTimeString('es-BO')
    ]);
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/health-records/:id error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Historial público de salud para la página pública del QR.
router.get('/public/:id/health', async (req, res) => {
  try {
    const pet = await db.get('SELECT id, carnet_number FROM pets WHERE id = $1', [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'No encontrada' });
    const rows = await getHealthRecordsForPet(req.params.id);
    const publicRecords = rows
      .filter(row => ['vacuna', 'desparasitacion', 'historial'].includes(row.type))
      .map(({ id, type, title, record_date, notes, applied, next_due, vet, product, weight, batch, scheduled_date, source }) =>
        ({ id, type, title, record_date, notes, applied, next_due, vet, product, weight, batch, scheduled_date, source })
      );
    res.json({ pet: { id: pet.id, carnet_number: pet.carnet_number }, records: publicRecords });
  } catch (e) {
    console.error('GET /api/pets/public/:id/health error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// ENDPOINTS DE DATOS MÉDICOS DETALLADOS
// ============================================

// Obtener detalles médicos de una mascota
router.get('/:id/medical-details', authenticateToken, async (req, res) => {
  try {
    const pet = await db.get('SELECT id, owner_ci FROM pets WHERE id = $1', [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada' });
    if (req.user.role === 'Espectador' && pet.owner_ci !== req.user.username) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const details = await db.get('SELECT * FROM pet_medical_details WHERE pet_id = $1', [req.params.id]);
    res.json(details || {});
  } catch (e) {
    console.error('GET /api/pets/:id/medical-details error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Guardar o actualizar detalles médicos de una mascota
router.put('/:id/medical-details', authenticateToken, requireAdminOrOperator, async (req, res) => {
  try {
    const pet = await db.get('SELECT id FROM pets WHERE id = $1', [req.params.id]);
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada' });

    const d = req.body;
    const existing = await db.get('SELECT id FROM pet_medical_details WHERE pet_id = $1', [req.params.id]);
    const now = new Date().toISOString();

    if (existing) {
      await db.run(`UPDATE pet_medical_details SET
        vaccines_list=$1, deworming_history=$2, medical_conditions=$3, allergies=$4, surgeries=$5,
        medications=$6, sterilized=$7, microchip=$8, blood_type=$9,
        vaccines_detail=$10, deworming_detail=$11, conditions_detail=$12, surgeries_detail=$13, medications_detail=$14, allergies_detail=$15, updated_at=$16
        WHERE pet_id=$17`, [
        d.vaccines_list || '', d.deworming_history || '', d.medical_conditions || '',
        d.allergies || '', d.surgeries || '', d.medications || '',
        d.sterilized ? 1 : 0, d.microchip || '', d.blood_type || '',
        d.vaccines_detail ? JSON.stringify(d.vaccines_detail) : '[]',
        d.deworming_detail ? JSON.stringify(d.deworming_detail) : '[]',
        d.conditions_detail ? JSON.stringify(d.conditions_detail) : '[]',
        d.surgeries_detail ? JSON.stringify(d.surgeries_detail) : '[]',
        d.medications_detail ? JSON.stringify(d.medications_detail) : '[]',
        d.allergies_detail ? JSON.stringify(d.allergies_detail) : '[]',
        now, req.params.id
      ]);
    } else {
      const id = 'md' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await db.run(`INSERT INTO pet_medical_details (
        id, pet_id, vaccines_list, deworming_history, medical_conditions, allergies, surgeries,
        medications, sterilized, microchip, blood_type,
        vaccines_detail, deworming_detail, conditions_detail, surgeries_detail, medications_detail, allergies_detail,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [
        id, req.params.id, d.vaccines_list || '', d.deworming_history || '',
        d.medical_conditions || '', d.allergies || '', d.surgeries || '',
        d.medications || '', d.sterilized ? 1 : 0, d.microchip || '', d.blood_type || '',
        d.vaccines_detail ? JSON.stringify(d.vaccines_detail) : '[]',
        d.deworming_detail ? JSON.stringify(d.deworming_detail) : '[]',
        d.conditions_detail ? JSON.stringify(d.conditions_detail) : '[]',
        d.surgeries_detail ? JSON.stringify(d.surgeries_detail) : '[]',
        d.medications_detail ? JSON.stringify(d.medications_detail) : '[]',
        d.allergies_detail ? JSON.stringify(d.allergies_detail) : '[]',
        now, now
      ]);
    }

    await db.run('INSERT INTO history (action, entity, "user", date, time) VALUES ($1,$2,$3,$4,$5)', [
      'Actualización de datos médicos', 'Datos médicos extendidos', req.user.name,
      new Date().toLocaleDateString('es-BO'), new Date().toLocaleTimeString('es-BO')
    ]);

    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/pets/:id/medical-details error:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
