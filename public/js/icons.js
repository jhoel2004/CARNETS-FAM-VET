// Familia única de iconos estilo Lucide: trazo 1.9, round caps, 24x24, currentColor.
const w = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const iconGrid = w(`<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>`);
export const iconPaw = w(`<circle cx="7.5" cy="10" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="16.5" cy="10" r="1.8"/><path d="M12 11.5c-2.8 0-5 2.1-5 4.4 0 1.6 1.2 2.6 2.7 2.6 0.8 0 1.5-.3 2.3-.3s1.5.3 2.3.3c1.5 0 2.7-1 2.7-2.6 0-2.3-2.2-4.4-5-4.4z"/>`);
export const iconCard = w(`<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11.5" r="2"/><path d="M5.5 16.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M14 9.5h5M14 13h5"/>`);
export const iconSearch = w(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`);
export const iconClock = w(`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`);
export const iconGear = w(`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9c0 .8.7 1.5 1.5 1.5H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>`);
export const iconLogout = w(`<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>`);
export const iconMenu = w(`<path d="M4 6h16M4 12h16M4 18h16"/>`);
export const iconEye = w(`<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>`);
export const iconEdit = w(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>`);
export const iconTrash = w(`<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/>`);
export const iconX = w(`<path d="M18 6L6 18M6 6l12 12"/>`);
export const iconUpload = w(`<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>`);
export const iconCheck = w(`<path d="M20 6L9 17l-5-5"/>`);
export const iconCheckCircle = w(`<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5.5"/>`);
export const iconAlert = w(`<path d="M12 8.5V13M12 16.5h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>`);
export const iconPlus = w(`<path d="M12 5v14M5 12h14"/>`);
export const iconPrinter = w(`<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>`);
export const iconDownload = w(`<path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/>`);
export const iconFileDown = w(`<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 11v6M9 14.5l3 3 3-3"/>`);
export const iconUser = w(`<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.2 3.9-5 7-5s5.8 1.8 7 5"/>`);
export const iconPhone = w(`<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0122 16.9z"/>`);
export const iconPin = w(`<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0z"/><circle cx="12" cy="10" r="3"/>`);

export function pawSvg(size = 34) {
  return `<svg class="paw" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="7" cy="9.5" r="2" fill="#C59A38"/><circle cx="12" cy="6.2" r="2" fill="#C59A38"/><circle cx="17" cy="9.5" r="2" fill="#C59A38"/><path d="M7 15.4c0-2.5 2.1-4.4 5-4.4s5 1.9 5 4.4-2.2 3.9-5 3.9-5-1.4-5-3.9z" fill="#C59A38"/></svg>`;
}
