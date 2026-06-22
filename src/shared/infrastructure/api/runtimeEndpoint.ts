const runtimeHostname = typeof window !== 'undefined' && window.location.hostname
  ? window.location.hostname
  : 'localhost';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? `http://${runtimeHostname}:3001`;
export const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? API_BASE_URL;
