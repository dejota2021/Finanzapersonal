import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ProjectFinanceState, Transaction, BudgetDestination, ProjectSettings, SyncEvent } from '../types';

// Initialize Firebase client-side safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

/**
 * Fetch initial finances state either from Firestore directly or using the fallback server API.
 */
export async function fetchFinances(): Promise<ProjectFinanceState> {
  try {
    // 1. Get settings doc
    const settingsDocRef = doc(db, 'settings', 'project');
    const settingsSnap = await getDoc(settingsDocRef);
    let settings: ProjectSettings = {
      projectName: "Sistema de Finanza",
      genreOrStyle: "Moderno",
      currency: "COP",
      currencySymbol: "$",
      taxRatePercent: 0,
      partners: [
        { id: 'socio-1', name: 'Socio 1', role: 'Productor', sharePercent: 50, color: '#3b82f6', avatarBg: 'bg-blue-500' },
        { id: 'socio-2', name: 'Socio 2', role: 'Director', sharePercent: 50, color: '#ef4444', avatarBg: 'bg-red-500' }
      ]
    };
    if (settingsSnap.exists()) {
      settings = settingsSnap.data() as ProjectSettings;
    }

    // 2. Get budgets
    const budgetsCol = collection(db, 'budgets');
    const budgetsSnap = await getDocs(budgetsCol);
    const budgets = budgetsSnap.docs.map(d => d.data() as BudgetDestination);

    // 3. Get transactions
    const txCol = collection(db, 'transactions');
    const txSnap = await getDocs(txCol);
    const transactions = txSnap.docs
      .map(d => d.data() as Transaction)
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

    // 4. Get attachments
    const attCol = collection(db, 'attachments');
    const attSnap = await getDocs(attCol);
    const attachments = attSnap.docs.map(d => d.data() as any);

    return {
      settings,
      budgets,
      transactions,
      attachments,
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.warn('Direct Firestore fetch failed, falling back to server API:', err);
    const res = await fetch('/api/finances');
    if (!res.ok) throw new Error('Error al cargar datos financieros desde el servidor');
    return res.json();
  }
}

/**
 * Create a new transaction.
 */
export async function createTransaction(tx: Partial<Transaction>): Promise<{ transaction: Transaction; event: SyncEvent }> {
  const transaction = {
    ...tx,
    id: tx.id || `tx-${Date.now()}`,
    createdAt: tx.createdAt || new Date().toISOString(),
  } as Transaction;

  try {
    const txDocRef = doc(db, 'transactions', transaction.id);
    await setDoc(txDocRef, transaction);

    const event: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'TRANSACTION_ADDED',
      data: transaction,
      message: 'Nueva transacción agregada',
      partnerName: 'Sistema',
      timestamp: new Date().toISOString(),
    };
    return { transaction, event };
  } catch (err) {
    console.warn('Direct Firestore save failed, using server API:', err);
    const res = await fetch('/api/finances/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error('Error al guardar la transacción en el servidor');
    return res.json();
  }
}

/**
 * Update an existing transaction.
 */
export async function updateTransaction(id: string, tx: Partial<Transaction>): Promise<{ transaction: Transaction }> {
  try {
    const txDocRef = doc(db, 'transactions', id);
    const docSnap = await getDoc(txDocRef);
    if (!docSnap.exists()) {
      throw new Error('Transacción no encontrada en Firestore');
    }
    const currentData = docSnap.data() as Transaction;
    const updated = {
      ...currentData,
      ...tx,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(txDocRef, updated);
    return { transaction: updated };
  } catch (err) {
    console.warn('Direct Firestore update failed, using server API:', err);
    const res = await fetch(`/api/finances/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (!res.ok) throw new Error('Error al actualizar la transacción en el servidor');
    return res.json();
  }
}

/**
 * Delete a transaction.
 */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    const txDocRef = doc(db, 'transactions', id);
    await deleteDoc(txDocRef);
  } catch (err) {
    console.warn('Direct Firestore delete failed, using server API:', err);
    const res = await fetch(`/api/finances/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar la transacción en el servidor');
  }
}

/**
 * Save all budgets / destinations.
 */
export async function saveBudgets(budgets: BudgetDestination[]): Promise<void> {
  try {
    const budgetsCol = collection(db, 'budgets');
    const snap = await getDocs(budgetsCol);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'budgets', d.id));
    }
    for (const b of budgets) {
      await setDoc(doc(db, 'budgets', b.id), b);
    }
  } catch (err) {
    console.warn('Direct Firestore save budgets failed, using server API:', err);
    const res = await fetch('/api/finances/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgets }),
    });
    if (!res.ok) throw new Error('Error al guardar presupuestos y destinos');
  }
}

/**
 * Save project settings.
 */
export async function saveSettings(settings: Partial<ProjectSettings>): Promise<void> {
  try {
    const settingsDocRef = doc(db, 'settings', 'project');
    const settingsSnap = await getDoc(settingsDocRef);
    const current = settingsSnap.exists() ? settingsSnap.data() : {};
    const updated = {
      ...current,
      ...settings,
    };
    await setDoc(settingsDocRef, updated);
  } catch (err) {
    console.warn('Direct Firestore save settings failed, using server API:', err);
    const res = await fetch('/api/finances/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) throw new Error('Error al guardar configuración');
  }
}

/**
 * Reset all finances.
 */
export async function resetFinances(): Promise<void> {
  try {
    const txCol = collection(db, 'transactions');
    const snap = await getDocs(txCol);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
    }
  } catch (err) {
    console.warn('Direct Firestore reset failed, using server API:', err);
    const res = await fetch('/api/finances/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Error al reiniciar finanzas');
  }
}

/**
 * Restore manual backups.
 */
export async function restoreFinances(state: ProjectFinanceState): Promise<void> {
  try {
    // 1. Settings
    await setDoc(doc(db, 'settings', 'project'), state.settings);

    // 2. Budgets
    const budgetsCol = collection(db, 'budgets');
    const bSnap = await getDocs(budgetsCol);
    for (const d of bSnap.docs) {
      await deleteDoc(doc(db, 'budgets', d.id));
    }
    for (const b of state.budgets) {
      await setDoc(doc(db, 'budgets', b.id), b);
    }

    // 3. Transactions
    const txCol = collection(db, 'transactions');
    const tSnap = await getDocs(txCol);
    for (const d of tSnap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
    }
    for (const t of state.transactions) {
      await setDoc(doc(db, 'transactions', t.id), t);
    }

    // 4. Attachments
    const attCol = collection(db, 'attachments');
    const aSnap = await getDocs(attCol);
    for (const d of aSnap.docs) {
      await deleteDoc(doc(db, 'attachments', d.id));
    }
    if (state.attachments) {
      for (const a of state.attachments) {
        await setDoc(doc(db, 'attachments', a.id), a);
      }
    }
  } catch (err) {
    console.warn('Direct Firestore restore failed, using server API:', err);
    try {
      await fetch('/api/finances/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch (serverErr) {
      console.warn('Could not restore state to server', serverErr);
    }
  }
}

/**
 * Interpret audio/voice note with server-side proxy (hides Gemini API key).
 */
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

/**
 * Fetch server-side version data.
 */
export async function fetchVersion(): Promise<{
  lastUpdated: string;
  txCount: number;
  budgetsCount: number;
  projectName: string;
  onlineCount: number;
  timestamp: string;
}> {
  try {
    const res = await fetch('/api/finances/version');
    if (!res.ok) throw new Error('Error al verificar versión de datos');
    return res.json();
  } catch (err) {
    return {
      lastUpdated: new Date().toISOString(),
      txCount: 0,
      budgetsCount: 0,
      projectName: "Sistema de Finanza",
      onlineCount: 1,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Upload receipt attachments.
 */
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
  const newAttachment = {
    ...attachment,
    id: `att-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'attachments', newAttachment.id), newAttachment);
    return newAttachment;
  } catch (err) {
    console.warn('Direct Firestore attachment upload failed, using server API:', err);
    const res = await fetch('/api/finances/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attachment),
    });
    if (!res.ok) throw new Error('Error al guardar el archivo adjunto');
    return res.json();
  }
}

/**
 * Delete a receipt attachment.
 */
export async function deleteAttachment(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'attachments', id));
  } catch (err) {
    console.warn('Direct Firestore attachment delete failed, using server API:', err);
    const res = await fetch(`/api/finances/attachments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar el archivo adjunto');
  }
}

/**
 * Real-time listeners via Firestore `onSnapshot`.
 * Falls back to SSE streams seamlessly if direct Firestore triggers error.
 */
export function subscribeToSync(
  onEvent: (event: SyncEvent) => void,
  onStatusChange?: (connected: boolean, initialOnlineCount?: number) => void
): () => void {
  let unsubDocs: (() => void)[] = [];
  let isFirestoreConnected = false;

  try {
    // 1. Subscribe to Transactions
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      isFirestoreConnected = true;
      onStatusChange?.(true, 1);
      
      snapshot.docChanges().forEach((change) => {
        const tx = change.doc.data() as Transaction;
        if (change.type === 'added') {
          onEvent({
            id: `ev-${Date.now()}-${tx.id}`,
            type: 'TRANSACTION_ADDED',
            data: tx,
            message: 'Transacción agregada en tiempo real',
            partnerName: tx.createdByName || 'Socio',
            timestamp: new Date().toISOString()
          });
        } else if (change.type === 'modified') {
          onEvent({
            id: `ev-${Date.now()}-${tx.id}`,
            type: 'TRANSACTION_UPDATED',
            data: tx,
            message: 'Transacción actualizada en tiempo real',
            partnerName: tx.createdByName || 'Socio',
            timestamp: new Date().toISOString()
          });
        } else if (change.type === 'removed') {
          onEvent({
            id: `ev-${Date.now()}-${tx.id}`,
            type: 'TRANSACTION_DELETED',
            data: tx.id,
            message: 'Transacción eliminada en tiempo real',
            partnerName: 'Sistema',
            timestamp: new Date().toISOString()
          });
        }
      });
    }, (error) => {
      console.warn('Firestore transactions subscription failed, defaulting to SSE stream:', error);
      startFallbackSSE();
    });
    unsubDocs.push(unsubTx);

    // 2. Subscribe to Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'project'), (snap) => {
      if (snap.exists()) {
        const settings = snap.data() as ProjectSettings;
        onEvent({
          id: `ev-${Date.now()}`,
          type: 'SETTINGS_UPDATED',
          data: settings,
          message: 'Configuración actualizada en tiempo real',
          partnerName: 'Sistema',
          timestamp: new Date().toISOString()
        });
      }
    }, (error) => {
      console.warn('Firestore settings subscription failed:', error);
    });
    unsubDocs.push(unsubSettings);

    // 3. Subscribe to Budgets
    const unsubBudgets = onSnapshot(collection(db, 'budgets'), (snapshot) => {
      const budgets = snapshot.docs.map(d => d.data() as BudgetDestination);
      if (budgets.length > 0) {
        onEvent({
          id: `ev-${Date.now()}`,
          type: 'BUDGET_SAVED',
          data: budgets,
          message: 'Destinos de presupuesto actualizados',
          partnerName: 'Sistema',
          timestamp: new Date().toISOString()
        });
      }
    }, (error) => {
      console.warn('Firestore budgets subscription failed:', error);
    });
    unsubDocs.push(unsubBudgets);

    // 4. Subscribe to Attachments
    const unsubAtt = onSnapshot(collection(db, 'attachments'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const att = change.doc.data() as any;
        if (change.type === 'added') {
          onEvent({
            id: `ev-${Date.now()}-${att.id}`,
            type: 'ATTACHMENT_ADDED',
            data: att,
            message: 'Archivo adjunto agregado en tiempo real',
            partnerName: 'Socio',
            timestamp: new Date().toISOString()
          });
        } else if (change.type === 'removed') {
          onEvent({
            id: `ev-${Date.now()}-${att.id}`,
            type: 'ATTACHMENT_DELETED',
            data: att.id,
            message: 'Archivo adjunto eliminado en tiempo real',
            partnerName: 'Sistema',
            timestamp: new Date().toISOString()
          });
        }
      });
    }, (error) => {
      console.warn('Firestore attachments subscription failed:', error);
    });
    unsubDocs.push(unsubAtt);

  } catch (err) {
    console.warn('Error starting client-side Firestore synchronization, defaulting to SSE stream:', err);
    startFallbackSSE();
  }

  // Fallback SSE implementation
  let eventSource: EventSource | null = null;
  let retryTimeout: any = null;

  function startFallbackSSE() {
    if (isFirestoreConnected) return; // If firestore has taken over, skip SSE

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
      retryTimeout = setTimeout(startFallbackSSE, 2000);
    };
  }

  // If after 3 seconds Firestore hasn't reported connection, run SSE fallback too
  const fallbackTimer = setTimeout(() => {
    if (!isFirestoreConnected) {
      console.log('No direct Firestore snapshot detected yet, initiating SSE fallback channel.');
      startFallbackSSE();
    }
  }, 3000);

  return () => {
    clearTimeout(fallbackTimer);
    unsubDocs.forEach(unsub => unsub());
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) eventSource.close();
  };
}
