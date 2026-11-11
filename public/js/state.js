import { api } from './api.js';
import { setToken } from './api.js';

class AppState {
  constructor() {
    this._pets = [];
    this._users = [];
    this._settings = {};
    this._history = [];
    this._healthRecords = {};        // Map petId -> records[]
    this._allHealthRecordsMap = null; // Map petId -> records[] (para dashboard)
    this._analytics = { medicalDetails: [] };
    this._user = null;
    this._species = [];   // especies personalizadas (catálogo)
    this._breeds = [];    // razas guardadas por especie (catálogo)
    this.view = 'dashboard';
    this.search = '';
    this.filterSpecies = '';
    this.filterStatus = '';
    this.filterSex = '';
    this.filterUser = '';   // filtro de mascotas por usuario responsable
    this.cardPetId = null;
    this.cardTemplate = null;
    this.sidebarOpen = false;
    this.theme = localStorage.getItem('pli-theme') || 'light';
  }

  get user() { return this._user; }
  setUser(u) { this._user = u; }

  getPets() { return this._pets; }
  getUsers() { return this._users; }
  getSpecies() { return this._species; }
  getBreeds() { return this._breeds; }
  getSettings() { return this._settings; }
  setSettings(s) { this._settings = s || {}; }
  getHistory() { return this._history; }
  getHealthRecords(petId) { return this._healthRecords[petId] || []; }
  getAllHealthRecordsMap() { return this._allHealthRecordsMap || new Map(); }
  getAnalytics() { return this._analytics || { medicalDetails: [] }; }

  setView(v) { this.view = v; }

  async init() {
    if (!this._user) {
      const token = localStorage.getItem('pli-token');
      if (!token) return;
      try {
        const data = await api.me();
        this._user = data.user;
      } catch {
        setToken(null);
        this._user = null;
        return;
      }
    }
    const tasks = [this.loadPets(), this.loadSettings(), this.loadCatalog()];
    if (this._user.role !== 'Espectador') {
      tasks.push(this.loadHistory());
      tasks.push(this.loadUsers());
      tasks.push(this.loadAnalytics());
    }
    await Promise.all(tasks);
    await this.loadAllHealthRecords();
  }

  async loadPets() {
    try { this._pets = await api.getPets(); } catch { this._pets = []; }
  }

  async loadHealthRecords(petId) {
    try { this._healthRecords[petId] = await api.getHealthRecords(petId); } catch { this._healthRecords[petId] = []; }
  }

  async loadPublicHealthRecords(petId) {
    const data = await api.getPublicPetHealth(petId);
    this._healthRecords[petId] = data.records || [];
    return this._healthRecords[petId];
  }

  async loadAllHealthRecords() {
    try {
      // Fuente única: /api/pets/analytics ya trae todos los health records.
      // Evita el N+1 que hacía una petición por mascota.
      const analytics = this._analytics || {};
      if (Array.isArray(analytics.healthRecords)) {
        const map = new Map();
        for (const r of analytics.healthRecords) {
          if (!r || !r.pet_id) continue;
          const arr = map.get(r.pet_id);
          if (arr) arr.push(r); else map.set(r.pet_id, [r]);
        }
        map.forEach((recs, petId) => { this._healthRecords[petId] = recs; });
        this._allHealthRecordsMap = map;
        return;
      }
      const map = new Map();
      for (const p of this._pets) {
        try {
          const recs = await api.getHealthRecords(p.id);
          map.set(p.id, recs);
          this._healthRecords[p.id] = recs;
        } catch { map.set(p.id, []); }
      }
      this._allHealthRecordsMap = map;
    } catch { this._allHealthRecordsMap = new Map(); }
  }

  async loadUsers() {
    try { this._users = await api.getUsers(); } catch { this._users = []; }
  }

  async loadCatalog() {
    try { this._species = await api.getSpecies(); } catch { this._species = []; }
    try { this._breeds = await api.getBreeds(); } catch { this._breeds = []; }
  }

  async loadSettings() {
    try { this._settings = await api.getSettings(); } catch { this._settings = {}; }
  }

  async loadHistory() {
    try { this._history = await api.getHistory(); } catch { this._history = []; }
  }

  async loadAnalytics() {
    try { this._analytics = await api.getDashboardAnalytics(); }
    catch { this._analytics = { medicalDetails: [] }; }
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    try { localStorage.setItem('pli-theme', this.theme); } catch (e) { }
  }
}

export const state = new AppState();
