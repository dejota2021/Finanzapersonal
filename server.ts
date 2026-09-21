import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { ProjectFinanceState, Transaction, BudgetDestination, SyncEvent } from './src/types';
import { parseVoiceInput } from './src/utils/voiceParser';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '30mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'finances.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default state
const initialData: ProjectFinanceState = {
  settings: {
    projectName: 'SISTEMA DE FINANZA',
    genreOrStyle: 'General',
    currency: 'COP',
    currencySymbol: '$',
    taxRatePercent: 0,
    dailyBudget: 0,
    partners: [
      {
        id: 'socio-1',
        name: 'Socio 1',
        role: 'Integrante',
        sharePercent: 50,
        color: '#f59e0b',
        avatarBg: 'from-amber-500 to-orange-600',
      },
      {
        id: 'socio-2',
        name: 'Socio 2',
        role: 'Integrante',
        sharePercent: 50,
        color: '#8b5cf6',
        avatarBg: 'from-purple-500 to-indigo-600',
      },
    ],
  },
  budgets: [
    {
      id: 'dest-1',
      destination: 'Proyecto',
      monthlyLimit: 0,
      color: '#f59e0b',
      iconName: 'Tag',
      description: 'Gastos e ingresos generales del proyecto',
    },
    {
      id: 'dest-2',
      destination: 'Efectivo',
      monthlyLimit: 0,
      color: '#10b981',
      iconName: 'Tag',
      description: 'Caja menor y efectivo disponible',
    },
    {
      id: 'dest-3',
      destination: 'Producción',
      monthlyLimit: 0,
      color: '#8b5cf6',
      iconName: 'Tag',
      description: 'Producción y grabación',
    },
  ],
  transactions: [],
  attachments: [],
  lastUpdated: new Date().toISOString(),
};

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseApp: any = null;
let db: any = null;

try {
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('Firebase Firestore initialized successfully from config.');
  } else {
    console.warn('firebase-applet-config.json not found. Using local filesystem as fallback.');
  }
} catch (err: any) {
  console.error('Failed to initialize Firebase:', err.message);
}

let cachedState: ProjectFinanceState = { ...initialData };
let isFirestoreSynced = false;

// Async synchronization of Firestore database
async function syncFromFirestore() {
  if (!db) {
    console.warn('Firestore is not configured. Falling back to local filesystem.');
    cachedState = loadStateLocal();
    return;
  }

  try {
    console.log('Syncing database state from Firestore...');
    const settingsDocRef = doc(db, 'settings', 'project');
    const settingsSnap = await getDoc(settingsDocRef);

    if (settingsSnap.exists()) {
      cachedState.settings = settingsSnap.data() as any;

      // Load budgets
      const budgetsCol = collection(db, 'budgets');
      const budgetsSnap = await getDocs(budgetsCol);
      cachedState.budgets = budgetsSnap.docs.map(d => d.data() as BudgetDestination);

      // Load transactions
      const txCol = collection(db, 'transactions');
      const txSnap = await getDocs(txCol);
      cachedState.transactions = txSnap.docs
        .map(d => d.data() as Transaction)
        .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

      // Load attachments
      const attCol = collection(db, 'attachments');
      const attSnap = await getDocs(attCol);
      cachedState.attachments = attSnap.docs.map(d => d.data() as any);

      cachedState.lastUpdated = new Date().toISOString();
      console.log(`Firestore loaded successfully: ${cachedState.transactions.length} transactions, ${cachedState.budgets.length} budgets, ${cachedState.attachments?.length || 0} attachments.`);
      isFirestoreSynced = true;
    } else {
      console.log('Firestore is empty. Commencing automatic migration of local files to Firestore...');
      const localData = loadStateLocal();
      cachedState = { ...localData };

      // Initialize settings
      await setDoc(settingsDocRef, cachedState.settings);

      // Save budgets
      for (const b of cachedState.budgets) {
        await setDoc(doc(db, 'budgets', b.id), b);
      }

      // Save transactions
      for (const t of cachedState.transactions) {
        await setDoc(doc(db, 'transactions', t.id), t);
      }

      // Save attachments
      if (cachedState.attachments && cachedState.attachments.length > 0) {
        for (const a of cachedState.attachments) {
          await setDoc(doc(db, 'attachments', a.id), a);
        }
      }

      console.log('Migration to Firestore completed successfully.');
      isFirestoreSynced = true;
    }
  } catch (err: any) {
    console.error('Error loading state from Firestore, falling back to local files:', err.message);
    cachedState = loadStateLocal();
  }
}

// Local loaders as fallbacks
function loadStateLocal(): ProjectFinanceState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.attachments) {
        parsed.attachments = [];
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading local file, falling back to initial data', err);
  }
  return { ...initialData };
}

// In-memory state accessor
function loadState(): ProjectFinanceState {
  return cachedState;
}

// Background Firestore writers to keep everything fully updated in real-time!
async function saveSettingsToFirestore(settings: any) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'settings', 'project'), settings);
  } catch (err: any) {
    console.error('Failed to write settings to Firestore:', err.message);
  }
}

async function saveBudgetToFirestore(budget: BudgetDestination) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'budgets', budget.id), budget);
  } catch (err: any) {
    console.error('Failed to write budget to Firestore:', err.message);
  }
}

async function deleteBudgetFromFirestore(id: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'budgets', id));
  } catch (err: any) {
    console.error('Failed to delete budget from Firestore:', err.message);
  }
}

async function saveTransactionToFirestore(tx: Transaction) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'transactions', tx.id), tx);
  } catch (err: any) {
    console.error('Failed to write transaction to Firestore:', err.message);
  }
}

async function deleteTransactionFromFirestore(id: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'transactions', id));
  } catch (err: any) {
    console.error('Failed to delete transaction from Firestore:', err.message);
  }
}

async function saveAttachmentToFirestore(att: any) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'attachments', att.id), att);
  } catch (err: any) {
    console.error('Failed to write attachment to Firestore:', err.message);
  }
}

async function deleteAttachmentFromFirestore(id: string) {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'attachments', id));
  } catch (err: any) {
    console.error('Failed to delete attachment from Firestore:', err.message);
  }
}

async function clearTransactionsFromFirestore() {
  if (!db) return;
  try {
    const txCol = collection(db, 'transactions');
    const txSnap = await getDocs(txCol);
    for (const d of txSnap.docs) {
      await deleteDoc(doc(db, 'transactions', d.id));
    }
  } catch (err: any) {
    console.error('Failed to clear transactions from Firestore:', err.message);
  }
}

// Local file backup sync
function saveState(state: ProjectFinanceState) {
  try {
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local finances.json backup', err);
  }
}

// In-memory SSE connected clients for real-time synchronization
interface SSEClient {
  id: string;
  res: express.Response;
}

let sseClients: SSEClient[] = [];

function broadcastSSE(event: SyncEvent) {
  const dataString = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(dataString);
    } catch {
      // client dropped
    }
  });
}

function broadcastOnlineCount() {
  const count = sseClients.length;
  const event: SyncEvent = {
    id: `ev-online-${Date.now()}`,
    type: 'USER_ONLINE_COUNT',
    data: { count },
    message: `${count} ${count === 1 ? 'usuario conectado en vivo' : 'usuarios conectados en vivo'}`,
    partnerName: 'Sistema',
    timestamp: new Date().toISOString(),
  };
  broadcastSSE(event);
}

// --- API ROUTES ---

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), sseActive: sseClients.length });
});

// 1b. Fast version & status check for instant sync on enter/focus
app.get('/api/finances/version', (req, res) => {
  const state = loadState();
  res.json({
    lastUpdated: state.lastUpdated,
    txCount: state.transactions.length,
    budgetsCount: state.budgets.length,
    projectName: state.settings.projectName,
    onlineCount: Math.max(1, sseClients.length),
    timestamp: new Date().toISOString(),
  });
});

// 2. Get full state
app.get('/api/finances', (req, res) => {
  const state = loadState();
  res.json(state);
});

// 3. SSE Stream for instant synchronization across all users and AI
app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  sseClients.push({ id: clientId, res });

  const state = loadState();
  res.write(
    `data: ${JSON.stringify({
      type: 'CONNECTED',
      clientId,
      onlineCount: sseClients.length,
      lastUpdated: state.lastUpdated,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  broadcastOnlineCount();

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== clientId);
    broadcastOnlineCount();
  });
});

// 4. Add Transaction (with deduplication safety)
app.post('/api/finances/transactions', (req, res) => {
  try {
    const state = loadState();
    const assignedId = req.body.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTx: Transaction = {
      ...req.body,
      id: assignedId,
      createdAt: req.body.createdAt || new Date().toISOString(),
    };

    // Safeguard: Check if this exact transaction was already inserted
    const existingIndex = state.transactions.findIndex(
      (t) =>
        t.id === newTx.id ||
        (t.title === newTx.title &&
          Number(t.amount) === Number(newTx.amount) &&
          t.destination === newTx.destination &&
          t.type === newTx.type &&
          Math.abs(new Date(t.createdAt).getTime() - new Date(newTx.createdAt).getTime()) < 12000)
    );

    if (existingIndex !== -1) {
      state.transactions[existingIndex] = {
        ...state.transactions[existingIndex],
        ...newTx,
      };
      saveState(state);
      saveTransactionToFirestore(state.transactions[existingIndex]);
      return res.status(200).json({ success: true, transaction: state.transactions[existingIndex] });
    }

    state.transactions.unshift(newTx);
    saveState(state);
    saveTransactionToFirestore(newTx);

    const partnerName = state.settings.partners.find((p) => p.id === newTx.paidBy)?.name || newTx.paidBy || 'Usuario';
    const isVoice = Boolean(newTx.voiceRecorded);

    const syncEvent: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'TRANSACTION_ADDED',
      data: newTx,
      message: `${partnerName} registró ${isVoice ? 'vía IA por voz ' : ''}un ${newTx.type === 'expense' ? 'gasto' : 'ingreso'} de ${state.settings.currencySymbol}${Number(newTx.amount).toLocaleString('es-CO')} en "${newTx.destination}"`,
      partnerName,
      timestamp: new Date().toISOString(),
    };

    broadcastSSE(syncEvent);
    res.status(201).json({ success: true, transaction: newTx, event: syncEvent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update Transaction
app.put('/api/finances/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const state = loadState();
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    state.transactions[index] = {
      ...state.transactions[index],
      ...req.body,
      id,
    };
    saveState(state);
    saveTransactionToFirestore(state.transactions[index]);

    const updatedTx = state.transactions[index];
    const partnerName = state.settings.partners.find((p) => p.id === updatedTx.paidBy)?.name || updatedTx.paidBy || 'Usuario';

    const syncEvent: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'TRANSACTION_UPDATED',
      data: updatedTx,
      message: `${partnerName} actualizó el movimiento "${updatedTx.title}" (${state.settings.currencySymbol}${Number(updatedTx.amount).toLocaleString('es-CO')})`,
      partnerName,
      timestamp: new Date().toISOString(),
    };

    broadcastSSE(syncEvent);
    res.json({ success: true, transaction: updatedTx });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete Transaction
app.delete('/api/finances/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const state = loadState();
    const tx = state.transactions.find((t) => String(t.id) === String(id));
    state.transactions = state.transactions.filter((t) => String(t.id) !== String(id));
    saveState(state);
    deleteTransactionFromFirestore(id);

    if (tx) {
      const syncEvent: SyncEvent = {
        id: `ev-${Date.now()}`,
        type: 'TRANSACTION_DELETED',
        data: { id },
        message: `Se eliminó el movimiento "${tx.title}"`,
        partnerName: 'Sistema',
        timestamp: new Date().toISOString(),
      };
      broadcastSSE(syncEvent);
    }
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Update Budgets / Destinations
app.post('/api/finances/budgets', async (req, res) => {
  try {
    const { budgets } = req.body;
    if (!Array.isArray(budgets)) {
      return res.status(400).json({ error: 'Budgets debe ser un array' });
    }
    const state = loadState();
    state.budgets = budgets;
    saveState(state);

    if (db) {
      try {
        const budgetsCol = collection(db, 'budgets');
        const budgetsSnap = await getDocs(budgetsCol);
        for (const d of budgetsSnap.docs) {
          await deleteDoc(doc(db, 'budgets', d.id));
        }
        for (const b of budgets) {
          await setDoc(doc(db, 'budgets', b.id), b);
        }
      } catch (e: any) {
        console.error('Error syncing budgets to Firestore:', e.message);
      }
    }

    const syncEvent: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'BUDGET_SAVED',
      data: budgets,
      message: 'Destinos actualizados correctamente.',
      partnerName: 'Sistema',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE(syncEvent);
    res.json({ success: true, budgets: state.budgets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Update Settings
app.post('/api/finances/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    const state = loadState();
    state.settings = { ...state.settings, ...settings };
    saveState(state);
    saveSettingsToFirestore(state.settings);

    const syncEvent: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'SETTINGS_UPDATED',
      data: state.settings,
      message: `Configuración actualizada (${state.settings.projectName}).`,
      partnerName: 'Sistema',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE(syncEvent);
    res.json({ success: true, settings: state.settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8b. Reset all data to 0
app.post('/api/finances/reset', async (req, res) => {
  try {
    const state = loadState();
    state.transactions = [];
    saveState(state);
    clearTransactionsFromFirestore();

    const syncEvent: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'RESET_DATA' as any,
      data: { transactions: [] },
      message: 'Se reinició el sistema: todas las transacciones están en 0.',
      partnerName: 'Sistema',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE(syncEvent);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8c. Restore data
app.post('/api/finances/restore', async (req, res) => {
  try {
    const { state: incomingState } = req.body;
    if (!incomingState || !incomingState.settings) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const state = loadState();
    if (incomingState.transactions?.length > 0 || incomingState.settings?.dailyBudget !== undefined) {
      state.transactions = incomingState.transactions || state.transactions;
      state.settings = { ...state.settings, ...incomingState.settings };
      if (incomingState.budgets?.length > 0) {
        state.budgets = incomingState.budgets;
      }
      if (incomingState.attachments?.length > 0) {
        state.attachments = incomingState.attachments;
      }
      saveState(state);

      if (db) {
        try {
          await setDoc(doc(db, 'settings', 'project'), state.settings);
          const budgetsCol = collection(db, 'budgets');
          const budgetsSnap = await getDocs(budgetsCol);
          for (const d of budgetsSnap.docs) {
            await deleteDoc(doc(db, 'budgets', d.id));
          }
          for (const b of state.budgets) {
            await setDoc(doc(db, 'budgets', b.id), b);
          }
          await clearTransactionsFromFirestore();
          for (const t of state.transactions) {
            await setDoc(doc(db, 'transactions', t.id), t);
          }
          const attCol = collection(db, 'attachments');
          const attSnap = await getDocs(attCol);
          for (const d of attSnap.docs) {
            await deleteDoc(doc(db, 'attachments', d.id));
          }
          if (state.attachments) {
            for (const a of state.attachments) {
              await setDoc(doc(db, 'attachments', a.id), a);
            }
          }
        } catch (e: any) {
          console.error('Error during Firestore restore sync:', e.message);
        }
      }

      broadcastSSE({
        id: `ev-${Date.now()}`,
        type: 'SETTINGS_UPDATED',
        data: state.settings,
        message: 'Datos restaurados exitosamente',
        partnerName: 'Sistema',
        timestamp: new Date().toISOString(),
      });
    }
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8d. Upload / Attach file
app.post('/api/finances/attachments', async (req, res) => {
  try {
    const { name, size, type, fileCategory, year, month, scope, notes, dataUrl, uploadedBy } = req.body;
    if (!name || !dataUrl) {
      return res.status(400).json({ error: 'Nombre de archivo y datos requeridos' });
    }
    const state = loadState();
    if (!state.attachments) {
      state.attachments = [];
    }
    const newAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      size: Number(size) || 0,
      type: type || 'application/octet-stream',
      fileCategory: fileCategory || 'other',
      year: year !== undefined && year !== null ? Number(year) : null,
      month: month !== undefined && month !== null ? Number(month) : null,
      scope: scope || 'general',
      notes: notes || '',
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy || 'Usuario',
      dataUrl,
    };
    state.attachments.unshift(newAttachment);
    saveState(state);
    saveAttachmentToFirestore(newAttachment);

    const syncEvent: SyncEvent = {
      id: `ev-${Date.now()}`,
      type: 'ATTACHMENT_ADDED',
      data: newAttachment,
      message: `Se adjuntó el archivo "${name}" (${scope === 'general' ? 'General' : `${year || ''} ${month ? `Mes ${month}` : ''}`.trim()})`,
      partnerName: uploadedBy || 'Usuario',
      timestamp: new Date().toISOString(),
    };
    broadcastSSE(syncEvent);
    res.json({ success: true, attachment: newAttachment });
  } catch (err: any) {
    console.error('Error saving attachment:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8e. Delete Attachment
app.delete('/api/finances/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const state = loadState();
    if (!state.attachments) {
      state.attachments = [];
    }
    const att = state.attachments.find((a) => a.id === id);
    state.attachments = state.attachments.filter((a) => a.id !== id);
    saveState(state);
    deleteAttachmentFromFirestore(id);

    if (att) {
      const syncEvent: SyncEvent = {
        id: `ev-${Date.now()}`,
        type: 'ATTACHMENT_DELETED',
        data: { id },
        message: `Se eliminó el archivo adjunto "${att.name}"`,
        partnerName: 'Sistema',
        timestamp: new Date().toISOString(),
      };
      broadcastSSE(syncEvent);
    }
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. AI Voice Expense & Income Parser with Gemini & Colombian NLP
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

app.post('/api/voice/parse', async (req, res) => {
  const state = loadState();
  const { transcript, audioBase64, mimeType } = req.body;

  if (!transcript && !audioBase64) {
    return res.status(400).json({ error: 'Debes enviar texto o audio para procesar la nota de voz.' });
  }

  // Pre-compute local Colombian NLP baseline
  const baselineData = parseVoiceInput(transcript || '', state.budgets, state.settings.partners);

  try {
    const partner1 = state.settings.partners[0];
    const partner2 = state.settings.partners[1];
    const destinationsList = state.budgets.map((b) => b.destination).join(', ');

    const systemPrompt = `Eres un asistente contable financiero de alta precisión especializado en español y modismos financieros de Colombia / Latinoamérica. La moneda del proyecto es Pesos Colombianos (COP, símbolo ${state.settings.currencySymbol || '$'}). Tu labor es interpretar notas de voz o frases habladas de gastos e ingresos en español y extraer con total exactitud un objeto JSON estructurado.

Integrantes:
- Socio 1: "${partner1.name}" (ID: "${partner1.id}")
- Socio 2: "${partner2.name}" (ID: "${partner2.id}")

Destinos/categorías existentes: [${destinationsList || 'Proyecto, Efectivo, Producción, Lanzamiento, Ensayos, General'}]

REGLAS DE EXTRACCIÓN CRÍTICAS:
1. "amount": Valor numérico entero o decimal exacto en Pesos Colombianos (COP).
   - INTERPRETACIÓN DE NÚMEROS: Debes convertir todos los formatos verbales a números enteros.
   - Ejemplos de conversión: "1 millón 800" = 1800000, "1.8 millones" = 1800000, "5,000,000" = 5000000, "11 millones" = 11000000, "1.5 millones" = 1500000, "500 mil pesos" = 500000, "80 mil" = 80000, "11 palos" = 11000000, "50 lucas" = 50000.
   - NUNCA trunques valores de millones o miles. Si el texto implica millones, asegúrate de añadir todos los ceros necesarios.
2. "type": "income" (ingreso) o "expense" (gasto).
   - Palabras clave de ingresos (income): "ingresaron", "ingreso", "llegó", "llego", "tengo", "me enviaron", "nos enviaron", "enviaron", "entró", "recibimos", "cobro", "abono", "nos pagaron", "aporte", "venta", "facturamos". Si el usuario dice "llegó dinero", "ingresó dinero", "tengo tanto", "me enviaron tanto" (o variaciones), clasifícalo estrictamente como "income".
   - Palabras clave de gastos (expense): "gasté", "gaste", "gastamos", "gastó", "invertí", "invertimos", "invirtió", "perdí", "perdimos", "perdió", "gasto", "pagamos", "pagué", "compramos", "costó", "perder", "compré". Si el usuario dice "gasté tanto", "gaste tanto", "invertí tanto", "perdí tanto", clasifícalo estrictamente como "expense".
3. "title": Concepto o detalle limpio y conciso (ej: "Arroz chino", "Almuerzo", "Alquiler", "Cables"). NUNCA dejes verbos de relleno iniciales.
4. "destination": Clasificación obligatoria. Debes asignar el concepto (ej: "arroz chino") a la categoría o destino MÁS APROPIADO de la lista de destinos existentes: [${destinationsList || 'Proyecto, Efectivo, Producción, Lanzamiento, Ensayos, General'}].
   - Si el concepto es comida/arroz chino/restaurante -> Mapea a 'Alimentación' (si existe) o el destino más lógico disponible.
   - Si no estás seguro, usa 'Proyecto' o 'General'.
5. "paidByPartnerId": ID del socio ("${partner1.id}" o "${partner2.id}"). Por defecto "${partner1.id}".
6. "splitPartner1": 50.
7. "splitPartner2": 50.
8. "notes": Resumen breve de la nota hablada.

Responde ÚNICAMENTE con el objeto JSON válido.`;

    let userPromptContent: any[] = [];
    if (audioBase64) {
      userPromptContent = [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType || 'audio/webm',
          },
        },
        {
          text: `Escucha este audio y extrae el gasto o ingreso según las instrucciones. Transcripción previa si disponible: "${transcript || ''}".`,
        },
      ];
    } else {
      userPromptContent = [
        {
          text: `Frase hablada: "${transcript}"\nAnaliza y extrae los datos del movimiento en Pesos Colombianos (COP).`,
        },
      ];
    }

    const ai = getGeminiClient();
    
    let response: any;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        const generatePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userPromptContent,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout en llamada de IA')), 4500)
        );

        response = await Promise.race([generatePromise, timeoutPromise]);
        break; // Success
      } catch (err: any) {
        retries++;
        if (retries > maxRetries) throw err;
        console.warn(`Retry ${retries} for Gemini API after error:`, err.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
      }
    }
    const outputText = response.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(outputText);
    } catch {
      const cleaned = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    if (typeof parsedData.amount === 'string') {
      const cleanVal = parsedData.amount.replace(/[^0-9]/g, '');
      parsedData.amount = parseInt(cleanVal, 10) || 0;
    }

    if (
      !parsedData.amount ||
      parsedData.amount === 0 ||
      (baselineData.amount >= 1000 && parsedData.amount < 1000) ||
      (baselineData.amount >= 1000000 && parsedData.amount < 100000) ||
      (baselineData.amount > 0 && baselineData.amount % parsedData.amount === 0 && parsedData.amount < 100)
    ) {
      if (baselineData.amount > 0) {
        parsedData.amount = baselineData.amount;
      }
    }

    if (!parsedData.type || (baselineData.type === 'income' && parsedData.type !== 'income')) {
      parsedData.type = baselineData.type;
    }

    if (!parsedData.title || parsedData.title.length < 3 || parsedData.title.startsWith('me gast')) {
      parsedData.title = baselineData.title;
    }

    if (!parsedData.destination) {
      parsedData.destination = baselineData.destination;
    }

    if (!parsedData.paidByPartnerId) {
      parsedData.paidByPartnerId = baselineData.paidByPartnerId;
    }

    if (!parsedData.suggestedDestinations) {
      parsedData.suggestedDestinations = baselineData.suggestedDestinations;
    }

    res.json({
      success: true,
      data: parsedData,
      rawOutput: outputText,
    });
  } catch (err: any) {
    console.warn('Fallback to Colombian NLP voice parser:', err.message);
    res.status(200).json({
      success: true,
      fallback: true,
      message: err.message,
      data: baselineData,
    });
  }
});

// Vite Middleware for SPA development & static serving in production
async function startServer() {
  await syncFromFirestore();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finance Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
