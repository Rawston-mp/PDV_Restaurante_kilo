const runtimeHostname = typeof window !== 'undefined' && window.location.hostname
  ? window.location.hostname
  : 'localhost';

const configuredApiUrl = String(import.meta.env.VITE_API_URL ?? '').trim();
const configuredWsUrl = String(import.meta.env.VITE_WS_URL ?? '').trim();

export const API_BASE_URL = configuredApiUrl || `http://${runtimeHostname}:3001`;
export const WS_BASE_URL = configuredWsUrl || API_BASE_URL;
