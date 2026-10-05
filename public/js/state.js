import { api } from './api.js';
import { setToken } from './api.js';

class AppState {
  constructor() {
    this._pets = [];
    this._users = [];
    this._settings = {};
    this._history = [];
    this._user = null;
    this.view = 'dashboard';
    this.search = '';
    this.filterSpecies = '';
    this.filterStatus = '';
    this.filterSex = '';
    this.cardPetId = null;
    this.cardTemplate = null;
    this.sidebarOpen = false;
    this.theme = localStorage.getItem('pli-theme') || 'light';
  }

  get user() { return this._user; }
  setUser(u) { this._user = u; }

  getPets() { return this._pets; }
  getUsers() { return this._users; }
  getSettings() { return this._settings; }
  getHistory() { return this._history; }

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
    const tasks = [this.loadPets(), this.loadSettings()];
    if (this._user.role !== 'Espectador') {
      tasks.push(this.loadHistory());
      tasks.push(this.loadUsers());
    }
    await Promise.all(tasks);
  }

  async loadPets() {
    try { this._pets = await api.getPets(); } catch { this._pets = []; }
  }

  async loadUsers() {
    try { this._users = await api.getUsers(); } catch { this._users = []; }
  }

  async loadSettings() {
    try { this._settings = await api.getSettings(); } catch { this._settings = {}; }
  }

  async loadHistory() {
    try { this._history = await api.getHistory(); } catch { this._history = []; }
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    try { localStorage.setItem('pli-theme', this.theme); } catch (e) { }
  }
}

export const state = new AppState();
