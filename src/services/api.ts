import { ProjectFinanceState, Transaction, BudgetDestination, ProjectSettings, SyncEvent } from '../types';

export async function fetchFinances(): Promise<ProjectFinanceState> {
  const res = await fetch('/api/finances');
  if (!res.ok) throw new Error('Error al cargar datos financieros');
  return res.json();
}

export async function createTransaction(tx: Partial<Transaction>): Promise<{ transaction: Transaction; event: SyncEvent }> {
  const res = await fetch('/api/finances/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx),
  });
  if (!res.ok) throw new Error('Error al guardar la transacción');
  return res.json();
}

export async function updateTransaction(id: string, tx: Partial<Transaction>): Promise<{ transaction: Transaction }> {
  const res = await fetch(`/api/finances/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx),
  });
  if (!res.ok) throw new Error('Error al actualizar la transacción');
  return res.json();
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`/api/finances/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar la transacción');
}

export async function saveBudgets(budgets: BudgetDestination[]): Promise<void> {
  const res = await fetch('/api/finances/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budgets }),
  });
  if (!res.ok) throw new Error('Error al guardar presupuestos y destinos');
}

export async function saveSettings(settings: Partial<ProjectSettings>): Promise<void> {
  const res = await fetch('/api/finances/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error('Error al guardar configuración');
}

export async function resetFinances(): Promise<void> {
  const res = await fetch('/api/finances/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error al reiniciar finanzas');
}

export async function restoreFinances(state: ProjectFinanceState): Promise<void> {
  try {
    await fetch('/api/finances/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
  } catch (err) {
    console.warn('Could not restore state to server', err);
  }
}

export async function parseVoiceNote(params: {
  transcript?: string;
  audioBase64?: string;
  mimeType?: string;
}): Promise<any> {
  const res = await fetch('/api/voice/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Error al interpretar nota de voz');
  return res.json();
}

export async function fetchVersion(): Promise<{
  lastUpdated: string;
  txCount: number;
  budgetsCount: number;
  projectName: string;
  onlineCount: number;
  timestamp: string;
}> {
  const res = await fetch('/api/finances/version');
  if (!res.ok) throw new Error('Error al verificar versión de datos');
  return res.json();
}

export async function uploadAttachment(attachment: {
  name: string;
  size: number;
  type: string;
  fileCategory: 'pdf' | 'spreadsheet' | 'document' | 'other';
  year?: number | null;
  month?: number | null;
  scope: 'general' | 'year' | 'month';
  notes?: string;
  dataUrl: string;
  uploadedBy?: string;
}): Promise<any> {
  const res = await fetch('/api/finances/attachments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attachment),
  });
  if (!res.ok) throw new Error('Error al guardar el archivo adjunto');
  return res.json();
}

export async function deleteAttachment(id: string): Promise<void> {
  const res = await fetch(`/api/finances/attachments/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar el archivo adjunto');
}

export function subscribeToSync(
  onEvent: (event: SyncEvent) => void,
  onStatusChange?: (connected: boolean, initialOnlineCount?: number) => void
): () => void {
  let eventSource: EventSource | null = null;
  let retryTimeout: any = null;

  function connect() {
    eventSource = new EventSource('/api/sync/events');
    eventSource.onopen = () => {
      onStatusChange?.(true);
    };
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'CONNECTED') {
          if (data.onlineCount !== undefined) {
            onStatusChange?.(true, data.onlineCount);
          }
        } else if (data.type) {
          onEvent(data as SyncEvent);
        }
      } catch (err) {
        console.warn('Error parsing SSE event', err);
      }
    };
    eventSource.onerror = () => {
      onStatusChange?.(false);
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(connect, 1500);
    };
  }

  connect();

  return () => {
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) eventSource.close();
  };
}
