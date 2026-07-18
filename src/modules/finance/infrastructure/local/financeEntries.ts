export const financeEntriesStorageKey = 'pdv.finance.entries';
export const financeEntriesUpdatedEvent = 'pdv.finance.entries.updated';

export type FinanceEntryTab = 'DESPESAS' | 'RECEITA' | 'CONTA_CORRENTE';
export type FinanceEntryStatus = 'ABERTO' | 'PAGO' | 'RECEBIDO' | 'ESTORNADO';

export type StoredFinanceEntry = {
  id: string;
  financeCode?: string;
  tab: FinanceEntryTab;
  supplierName?: string;
  description?: string;
  categoryType?: string;
  amount: string;
  dueDate?: string;
  competenceDate?: string;
  accountName?: string;
  documentRef?: string;
  status: FinanceEntryStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  reversedFromEntryId?: string;
};

export const readFinanceEntriesLocal = (): StoredFinanceEntry[] => {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const rawEntries = localStorage.getItem(financeEntriesStorageKey);
    if (!rawEntries) {
      return [];
    }

    const parsedEntries = JSON.parse(rawEntries);
    return Array.isArray(parsedEntries) ? parsedEntries : [];
  } catch {
    return [];
  }
};

export const writeFinanceEntriesLocal = (entries: StoredFinanceEntry[]) => {
  localStorage.setItem(financeEntriesStorageKey, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent(financeEntriesUpdatedEvent));
};

export const isFinanceRevenueSettled = (entry: StoredFinanceEntry) =>
  entry.tab === 'RECEITA' && (entry.status === 'RECEBIDO' || entry.status === 'PAGO');
