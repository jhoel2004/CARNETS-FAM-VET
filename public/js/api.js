const BASE = (window.__API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('pli-token');
}

export function setToken(token) {
  if (token) localStorage.setItem('pli-token', token);
  else localStorage.removeItem('pli-token');
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  me: () => request('GET', '/auth/me'),

  // Pets
  getPets: () => request('GET', '/pets'),
  getPet: (id) => request('GET', '/pets/' + id),
  createPet: (pet) => request('POST', '/pets', pet),
  updatePet: (id, pet) => request('PUT', '/pets/' + id, pet),
  deletePet: (id) => request('DELETE', '/pets/' + id),
  getPublicPet: (id) => request('GET', '/pets/public/' + id),
  getPublicPetByCarnet: (carnet) => request('GET', '/pets/public/carnet/' + encodeURIComponent(carnet)),

  // Settings
  getSettings: () => request('GET', '/settings'),
  updateSettings: (settings) => request('PUT', '/settings', settings),

  // History
  getHistory: (limit) => request('GET', '/history' + (limit ? '?limit=' + limit : '')),
  logHistory: (action, entity) => request('POST', '/history', { action, entity }),

  // Users
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  deleteUser: (id) => request('DELETE', '/users/' + id)
};
