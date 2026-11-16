const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

// Local development uses Vite's /api and /socket.io proxy. Production defaults
// to the Render API so a missing Vercel environment variable never hits localhost.
export const API_BASE_URL = configuredApiUrl || (import.meta.env.DEV ? '' : 'https://voix-erp.onrender.com');
export const SOCKET_ENDPOINT = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);

export const apiUrl = (route) => `${API_BASE_URL}${route.startsWith('/') ? route : `/${route}`}`;
