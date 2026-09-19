import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { FinancialSummaryCards } from './components/FinancialSummaryCards';
import { ChartsView } from './components/ChartsView';
import { TransactionList } from './components/TransactionList';
import { VoiceExpenseModal } from './components/VoiceExpenseModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { DestinationManagerModal } from './components/DestinationManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { PushNotificationToast } from './components/PushNotificationToast';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  fetchFinances,
  fetchVersion,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  saveBudgets,
  saveSettings,
  resetFinances,
  subscribeToSync,
} from './services/api';
import {
  computeFinancials,
  filterTransactionsByPeriod,
  getAvailableYears,
  MONTHS_ES,
} from './utils/calculations';
import { exportToExcel } from './utils/exportExcel';
import { exportToPdf } from './utils/exportPdf';
import { playPushChime } from './utils/soundEffects';
import { ProjectFinanceState, Transaction, BudgetDestination, ProjectSettings, SyncEvent } from './types';
import { Loader2, Calendar, Sliders, X } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<ProjectFinanceState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Month & Year Sheets Filter State (managed via SettingsModal)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = Todo el año / histórico

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_dark_mode');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

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

  // Initial and reactive data load
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await fetchFinances();
      setState(data);
      if (data.lastUpdated) {
        lastUpdatedRef.current = data.lastUpdated;
      }
      setIsSynced(true);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load finances data:', err);
      setError(err.message || 'No se pudo cargar la información');
      setIsSynced(false);
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
          const exists = prev.transactions.some((t) => t.id === updatedTx.id);
          const newTxList = exists
            ? prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t))
            : [updatedTx, ...prev.transactions];
          return {
            ...prev,
            transactions: newTxList,
            lastUpdated: event.timestamp || new Date().toISOString(),
          };
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
      // If no month is selected, return all transactions for selected year
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
          partner: { id: 'p1', name: 'Deivid', sharePercent: 50, role: 'socio', color: '#3b82f6', avatarBg: 'bg-blue-500' },
          totalPaid: 0,
          totalReceived: 0,
          requiredExpenseShare: 0,
          netBalance: 0,
        },
        partner2Stats: {
          partner: { id: 'p2', name: 'Jota', sharePercent: 50, role: 'socio', color: '#f59e0b', avatarBg: 'bg-amber-500' },
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
      await updateTransaction(editingTransaction.id, txData);
    } else {
      await createTransaction(txData as Omit<Transaction, 'id' | 'createdAt'>);
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id);
  };

  const handleSaveBudgets = async (newBudgets: BudgetDestination[]) => {
    await saveBudgets(newBudgets);
  };

  const handleSaveSettings = async (newSettings: ProjectSettings) => {
    await saveSettings(newSettings);
  };

  const handleResetAll = async () => {
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
        monthlyLimit: 1000000,
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
      className={`min-h-screen transition-colors ${
        darkMode ? 'bg-neutral-950 text-neutral-100' : 'bg-neutral-100 text-neutral-900'
      } pb-24 sm:pb-12`}
    >
      {/* Top Navbar */}
      <Navbar
        state={state}
        darkMode={darkMode}
        isSynced={isSynced}
        isRefreshing={isRefreshing}
        onlineCount={onlineCount}
        onRefresh={() => loadData(false)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onUpdateProjectName={handleUpdateProjectName}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
        {/* Active Period Filter Indicator (if user filtered by a specific month/year) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Periodo Visualizado:
                </span>
                <span className="text-sm sm:text-base font-extrabold text-amber-500">
                  {selectedMonth
                    ? `${MONTHS_ES[selectedMonth - 1]} de ${selectedYear}`
                    : `Todo el Año ${selectedYear}`}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">
                {periodTransactions.length} movimiento(s) en este periodo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedMonth !== null && (
              <button
                type="button"
                onClick={() => setSelectedMonth(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Ver todos los meses del año"
              >
                <X className="w-3.5 h-3.5" />
                <span>Ver Todo el Año</span>
              </button>
            )}

            <button
              id="open-period-settings-btn"
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Cambiar mes o consultar consolidado histórico"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-500" />
              <span>Cambiar Hoja / Periodo</span>
            </button>
          </div>
        </div>

        {/* 1. Financial Summary Cards */}
        <div className={`${mobileTab === 'overview' ? 'block' : 'hidden sm:block'}`}>
          <FinancialSummaryCards
            financials={financials}
            settings={state.settings}
            darkMode={darkMode}
            onOpenDestinations={() => setIsDestinationsModalOpen(true)}
          />
        </div>

        {/* 2. Visual Charts */}
        <div className={`${mobileTab === 'charts' || mobileTab === 'overview' ? 'block' : 'hidden sm:block'}`}>
          <ChartsView
            financials={financials}
            settings={state.settings}
            transactions={periodTransactions}
            darkMode={darkMode}
          />
        </div>

        {/* 3. Transaction List */}
        <div className={`${mobileTab === 'transactions' || mobileTab === 'overview' ? 'block' : 'hidden sm:block'}`}>
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
          />
        </div>
      </main>

      {/* Real-time Push Notification Banner & Sound Chime */}
      <PushNotificationToast
        currentEvent={currentSyncEvent}
        onDismiss={() => setCurrentSyncEvent(null)}
        darkMode={darkMode}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentTab={mobileTab}
        onSelectTab={(tab) => {
          if (tab === 'settings') {
            setIsSettingsModalOpen(true);
          } else {
            setMobileTab(tab);
          }
        }}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        darkMode={darkMode}
      />

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
