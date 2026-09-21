import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FinancialSummaryCards } from './components/FinancialSummaryCards';
import { ChartsView } from './components/ChartsView';
import { TransactionList } from './components/TransactionList';
import { VoiceExpenseModal } from './components/VoiceExpenseModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { DestinationManagerModal } from './components/DestinationManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { PushNotificationToast } from './components/PushNotificationToast';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DesktopDashboard } from './components/DesktopDashboard';
import { PinLockScreen } from './components/PinLockScreen';
import {
  fetchFinances,
  fetchVersion,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  saveBudgets,
  saveSettings,
  resetFinances,
  restoreFinances,
  subscribeToSync,
} from './services/api';
import {
  computeFinancials,
  filterTransactionsByPeriod,
  getAvailableYears,
  deduplicateTransactions,
} from './utils/calculations';
import { exportToExcel } from './utils/exportExcel';
import { exportToPdf } from './utils/exportPdf';
import { playPushChime } from './utils/soundEffects';
import { ProjectFinanceState, Transaction, BudgetDestination, ProjectSettings, SyncEvent } from './types';
import { Loader2, Sliders } from 'lucide-react';

const STORAGE_KEY = 'sistema_finanzas_state_v1';

function getInitialLocalState(): ProjectFinanceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.settings) {
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          parsed.transactions = deduplicateTransactions(parsed.transactions);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error parsing cached local finance state', e);
  }
  return null;
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [state, setState] = useState<ProjectFinanceState | null>(() => getInitialLocalState());
  const [isLoading, setIsLoading] = useState(() => getInitialLocalState() === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Month & Year Filter State
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = Todo el año

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Realtime Cloud Sync Status & Active Users Online
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [currentSyncEvent, setCurrentSyncEvent] = useState<SyncEvent | null>(null);
  const lastUpdatedRef = useRef<string>('');

  // Mobile navigation tab
  const [mobileTab, setMobileTab] = useState<'overview' | 'transactions' | 'charts' | 'settings'>('overview');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isDestinationsModalOpen, setIsDestinationsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Debounce ref for page name auto-save
  const pageNameTimeoutRef = useRef<any>(null);

  // Persist dark mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_dark_mode', String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  // Persist state to local storage on any change
  useEffect(() => {
    if (state && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn('Error saving state to localStorage', err);
      }
    }
  }, [state]);

  // Initial and reactive data load
  const loadData = useCallback(async (silent = false) => {
    const localCached = getInitialLocalState();
    if (!silent && !localCached) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const serverData = await fetchFinances();
      if (serverData.transactions && Array.isArray(serverData.transactions)) {
        serverData.transactions = deduplicateTransactions(serverData.transactions);
      }
      const localData = getInitialLocalState();

      // Check if server is blank but user had manual data locally
      const serverIsEmpty = (!serverData.transactions || serverData.transactions.length === 0) &&
        (!serverData.settings.dailyBudget || serverData.settings.dailyBudget === 0);
      const localHasData = localData && (
        (localData.transactions && localData.transactions.length > 0) ||
        (localData.settings && localData.settings.dailyBudget && localData.settings.dailyBudget > 0)
      );

      if (serverIsEmpty && localHasData) {
        setState(localData);
        await restoreFinances(localData);
      } else {
        setState(serverData);
      }

      if (serverData.lastUpdated) {
        lastUpdatedRef.current = serverData.lastUpdated;
      }
      setIsSynced(true);
      setError(null);
    } catch (err: any) {
      console.warn('Failed to load finances from server, keeping local data:', err);
      const local = getInitialLocalState();
      if (local) {
        setState(local);
        setIsSynced(true);
        setError(null);
      } else {
        setError(err.message || 'No se pudo cargar la información');
        setIsSynced(false);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToSync((event: SyncEvent) => {
      setIsSynced(true);
      if (event.type === 'USER_ONLINE_COUNT') {
        if (event.data?.count) {
          setOnlineCount(event.data.count);
        }
        return;
      }

      setCurrentSyncEvent(event);
      playPushChime();

      if (event.type === 'TRANSACTION_ADDED' || event.type === 'TRANSACTION_UPDATED') {
        setState((prev) => {
          if (!prev) return prev;
          const updatedTx = event.data as Transaction;
          const existingIndex = prev.transactions.findIndex(
            (t) =>
              t.id === updatedTx.id ||
              (t.title === updatedTx.title &&
                Number(t.amount) === Number(updatedTx.amount) &&
                t.destination === updatedTx.destination &&
                t.type === updatedTx.type &&
                Math.abs(new Date(t.createdAt).getTime() - new Date(updatedTx.createdAt).getTime()) < 15000)
          );

          let newTxList: Transaction[];
          if (existingIndex !== -1) {
            newTxList = [...prev.transactions];
            newTxList[existingIndex] = updatedTx;
          } else {
            newTxList = [updatedTx, ...prev.transactions];
          }

          const next = {
            ...prev,
            transactions: newTxList,
            lastUpdated: event.timestamp || new Date().toISOString(),
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
      } else if (event.type === 'TRANSACTION_DELETED') {
        setState((prev) => {
          if (!prev) return prev;
          const { id } = event.data;
          return {
            ...prev,
            transactions: prev.transactions.filter((t) => t.id !== id),
            lastUpdated: event.timestamp || new Date().toISOString(),
          };
        });
      } else if (event.type === 'BUDGET_SAVED') {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            budgets: event.data,
            lastUpdated: event.timestamp || new Date().toISOString(),
          };
        });
      } else if (event.type === 'SETTINGS_UPDATED') {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            settings: event.data,
            lastUpdated: event.timestamp || new Date().toISOString(),
          };
        });
      } else if (event.type === 'RESET_DATA') {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            transactions: [],
            lastUpdated: event.timestamp || new Date().toISOString(),
          };
        });
      } else {
        loadData(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Check version on visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const ver = await fetchVersion();
          if (ver.onlineCount) {
            setOnlineCount(ver.onlineCount);
          }
          if (ver.lastUpdated && ver.lastUpdated !== lastUpdatedRef.current) {
            loadData(true);
          }
        } catch {
          // ignore background sync error
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

  // Available Years
  const availableYears = useMemo(() => {
    if (!state) return [now.getFullYear()];
    return getAvailableYears(state.transactions);
  }, [state, now]);

  // Filtered transactions for current selected period
  const periodTransactions = useMemo(() => {
    if (!state) return [];
    if (selectedMonth === null) {
      return state.transactions.filter((t) => {
        const y = new Date(t.date).getFullYear();
        return y === selectedYear;
      });
    }
    return filterTransactionsByPeriod(state.transactions, selectedYear, selectedMonth);
  }, [state, selectedYear, selectedMonth]);

  // Financial calculations
  const financials = useMemo(() => {
    if (!state) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        totalDeductible: 0,
        estimatedTaxSavings: 0,
        partner1Stats: {
          partner: { id: 'p1', name: 'Socio 1', sharePercent: 50, role: 'socio', color: '#f59e0b', avatarBg: 'bg-amber-500' },
          totalPaid: 0,
          totalReceived: 0,
          requiredExpenseShare: 0,
          netBalance: 0,
        },
        partner2Stats: {
          partner: { id: 'p2', name: 'Socio 2', sharePercent: 50, role: 'socio', color: '#8b5cf6', avatarBg: 'bg-purple-500' },
          totalPaid: 0,
          totalReceived: 0,
          requiredExpenseShare: 0,
          netBalance: 0,
        },
        settlement: {
          debtorName: '',
          debtorId: '',
          creditorName: '',
          creditorId: '',
          amount: 0,
          isBalanced: true,
        },
        destinationProgress: [],
      };
    }
    return computeFinancials(periodTransactions, state.budgets, state.settings);
  }, [state, periodTransactions]);

  // Handlers
  const handleSaveTransaction = async (txData: Partial<Transaction>) => {
    if (editingTransaction) {
      const updatedTx: Transaction = {
        ...editingTransaction,
        ...txData,
      } as Transaction;

      setState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          transactions: prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
          lastUpdated: new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

      await updateTransaction(editingTransaction.id, txData);
    } else {
      const canonicalId = txData.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newTx: Transaction = {
        id: canonicalId,
        title: txData.title || 'Movimiento',
        amount: Number(txData.amount) || 0,
        type: txData.type || 'expense',
        date: txData.date || new Date().toISOString().split('T')[0],
        destination: txData.destination || 'General',
        paidBy: txData.paidBy || 'general',
        splitRatio: txData.splitRatio || { general: 100 },
        isDeductible: txData.isDeductible || false,
        deductiblePercentage: txData.deductiblePercentage || 0,
        createdAt: new Date().toISOString(),
        notes: txData.notes,
        voiceRecorded: Boolean(txData.voiceRecorded),
      };

      setState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          transactions: deduplicateTransactions([newTx, ...prev.transactions]),
          lastUpdated: new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

      await createTransaction(newTx);
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    await deleteTransaction(id);
  };

  const handleSaveBudgets = async (newBudgets: BudgetDestination[]) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        budgets: newBudgets,
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    await saveBudgets(newBudgets);
  };

  const handleSaveSettings = async (newSettings: ProjectSettings) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        settings: newSettings,
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    await saveSettings(newSettings);
  };

  const handleResetAll = async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    setState((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        transactions: [],
        lastUpdated: new Date().toISOString(),
      };
      return next;
    });
    await resetFinances();
  };

  const handleUpdateProjectName = (newName: string) => {
    if (!state) return;
    const updatedSettings = { ...state.settings, projectName: newName };
    setState((prev) => (prev ? { ...prev, settings: updatedSettings } : null));

    if (pageNameTimeoutRef.current) {
      clearTimeout(pageNameTimeoutRef.current);
    }
    pageNameTimeoutRef.current = setTimeout(async () => {
      try {
        await saveSettings(updatedSettings);
      } catch (err) {
        console.error('Failed to auto-save project name:', err);
      }
    }, 600);
  };

  const handleAddNewDestination = async (destinationName: string) => {
    if (!state) return;
    const exists = state.budgets.some(
      (b) => b.destination.toLowerCase() === destinationName.toLowerCase()
    );
    if (!exists) {
      const newBudget: BudgetDestination = {
        id: `dest-${Date.now()}`,
        destination: destinationName,
        monthlyLimit: 0,
        color: '#f59e0b',
        iconName: 'Tag',
      };
      const updated = [...state.budgets, newBudget];
      await saveBudgets(updated);
    }
  };

  const handleExportExcel = () => {
    if (!state) return;
    exportToExcel(state);
  };

  const handleExportPdf = () => {
    if (!state) return;
    exportToPdf(state);
  };

  // Default date for new transaction
  const defaultSheetDate = useMemo(() => {
    const yyyy = selectedYear;
    const mm = selectedMonth ? String(selectedMonth).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(Math.min(now.getDate(), 28)).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [selectedYear, selectedMonth, now]);

  if (!isUnlocked) {
    return (
      <PinLockScreen
        onSuccess={() => setIsUnlocked(true)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  if (isLoading && !state) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-base font-bold text-neutral-300">
          Cargando Sistema de Finanzas...
        </p>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <Sliders className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-black mb-2">Error de conexión con el servidor</h1>
        <p className="text-sm text-neutral-400 max-w-md mb-6">{error}</p>
        <button
          onClick={() => loadData(false)}
          className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  if (!state) return null;

  return (
    <div
      id="app-root-container"
      className="min-h-screen bg-black text-neutral-100 pb-24 sm:pb-32"
    >
      {/* Real-time Push Notification Banner & Sound Chime */}
      <PushNotificationToast
        currentEvent={currentSyncEvent}
        onDismiss={() => setCurrentSyncEvent(null)}
        darkMode={darkMode}
      />

      {/* Desktop View */}
      <DesktopDashboard
        state={state}
        financials={financials}
        periodTransactions={periodTransactions}
        darkMode={darkMode}
        onEditTransaction={handleEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenAddModal={() => {
          setEditingTransaction(null);
          setIsAddModalOpen(true);
        }}
        onOpenDestinations={() => setIsDestinationsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />


      {/* Mobile View */}
      <main className="md:hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 space-y-6 sm:space-y-8">
        {/* 1. Financial Summary Cards (Overview / Resumen) */}
        <div className={`${mobileTab === 'overview' ? 'block' : 'hidden'}`}>
          <FinancialSummaryCards
            financials={financials}
            settings={state.settings}
            darkMode={darkMode}
            onOpenDestinations={() => setIsDestinationsModalOpen(true)}
          />
        </div>

        {/* 2. Visual Charts */}
        <div className={`${mobileTab === 'charts' ? 'block' : 'hidden'}`}>
          <div className="pt-4 pb-2">
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider font-mono">
              Análisis y Gráficos
            </h2>
            <p className="text-xs text-neutral-500 font-bold">Distribución y evolución mensual de tus finanzas</p>
          </div>
          <ChartsView
            financials={financials}
            settings={state.settings}
            transactions={periodTransactions}
            darkMode={darkMode}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          />
        </div>

        {/* 3. Transaction List */}
        <div className={`${mobileTab === 'transactions' ? 'block' : 'hidden'}`}>
          <TransactionList
            transactions={periodTransactions}
            settings={state.settings}
            budgets={state.budgets}
            darkMode={darkMode}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            onOpenAddModal={() => {
              setEditingTransaction(null);
              setIsAddModalOpen(true);
            }}
            onOpenDestinations={() => setIsDestinationsModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        </div>

        {/* 4. Settings View */}
        <div className={`${mobileTab === 'settings' ? 'block' : 'hidden'}`}>
          <SettingsModal
            isOpen={true}
            onClose={() => setMobileTab('overview')}
            settings={state.settings}
            transactions={state.transactions}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onSelectPeriod={(year, month) => {
              setSelectedYear(year);
              setSelectedMonth(month);
            }}
            availableYears={availableYears}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            isRefreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
            onSaveSettings={handleSaveSettings}
            onResetAll={handleResetAll}
          />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav
          currentTab={mobileTab}
          onSelectTab={(tab) => {
            setMobileTab(tab);
          }}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenSettings={() => setMobileTab('settings')}
          darkMode={darkMode}
        />
      </div>

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        editingTransaction={editingTransaction}
        defaultDate={defaultSheetDate}
        settings={state.settings}
        budgets={state.budgets}
        onSave={handleSaveTransaction}
        onAddNewDestination={handleAddNewDestination}
        darkMode={darkMode}
      />

      <VoiceExpenseModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        settings={state.settings}
        budgets={state.budgets}
        onSaveTransaction={handleSaveTransaction}
        onAddNewDestination={handleAddNewDestination}
        darkMode={darkMode}
      />

      <DestinationManagerModal
        isOpen={isDestinationsModalOpen}
        onClose={() => setIsDestinationsModalOpen(false)}
        budgets={state.budgets}
        settings={state.settings}
        onSaveBudgets={handleSaveBudgets}
        darkMode={darkMode}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={state.settings}
        transactions={state.transactions}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSelectPeriod={(year, month) => {
          setSelectedYear(year);
          setSelectedMonth(month);
        }}
        availableYears={availableYears}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(true)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onSaveSettings={handleSaveSettings}
        onResetAll={handleResetAll}
      />
    </div>
  );
}
