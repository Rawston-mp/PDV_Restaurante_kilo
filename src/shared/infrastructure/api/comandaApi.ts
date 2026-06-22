import type { ItemComanda } from '@/types/comanda';
import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

const API_BASE = API_BASE_URL;

type ComandaItemsResponse = {
  ok?: boolean;
  items?: ItemComanda[];
  itens?: ItemComanda[];
};

type SaveComandaItemsResponse = ComandaItemsResponse & {
  message?: string;
};

export type RegisterPesagemInput = {
  peso: number;
  origem: 'sensor' | 'manual' | string;
  owner?: 'COMANDA_A' | 'COMANDA_B';
  stationId?: 'BALANCA_A' | 'BALANCA_B';
  itemId?: string;
  productName?: string;
  reason?: string;
};

const parseBackendMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
};

const ensureValidNumero = (numero: string) => {
  const trimmed = numero.trim();
  if (!trimmed) {
    throw new Error('O número da comanda é obrigatório.');
  }

  return trimmed;
};

export const fetchComandaItemsFromBackend = async (numero: string): Promise<ItemComanda[]> => {
  const trimmed = ensureValidNumero(numero);
  const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(trimmed)}/items`);

  if (!response.ok) {
    throw new Error(await parseBackendMessage(response, 'Falha ao carregar itens da comanda.'));
  }

  const payload = (await response.json()) as ComandaItemsResponse;
  const items = Array.isArray(payload.items) ? payload.items : payload.itens;
  return Array.isArray(items) ? items : [];
};

export const saveComandaItemsToBackend = async (
  numero: string,
  items: ItemComanda[],
  reason = 'items_sync'
): Promise<ItemComanda[]> => {
  const trimmed = ensureValidNumero(numero);
  const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(trimmed)}/items`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items, reason })
  });

  if (!response.ok) {
    throw new Error(await parseBackendMessage(response, 'Falha ao salvar itens da comanda.'));
  }

  const payload = (await response.json()) as SaveComandaItemsResponse;
  const savedItems = Array.isArray(payload.items) ? payload.items : payload.itens;
  return Array.isArray(savedItems) ? savedItems : items;
};

export const registerComandaPesagemInBackend = async (numero: string, input: RegisterPesagemInput) => {
  const trimmed = ensureValidNumero(numero);
  const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(trimmed)}/pesagem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await parseBackendMessage(response, 'Falha ao registrar pesagem da comanda.'));
  }
};
