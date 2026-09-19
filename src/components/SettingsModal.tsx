import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  Sliders,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Layers,
  CalendarDays,
  Search,
} from 'lucide-react';
import { ProjectSettings, Transaction } from '../types';
import {
  computeMultiYearSummary,
  formatCurrency,
  MONTHS_ES,
  filterTransactionsByPeriod,
} from '../utils/calculations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  transactions?: Transaction[];
  selectedYear: number;
  selectedMonth: number | null;
  onSelectPeriod: (year: number, month: number | null) => void;
  availableYears: number[];
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onSaveSettings: (settings: ProjectSettings) => Promise<void>;
  onResetAll?: () => Promise<void>;
}

type SettingsTab = 'period' | 'consolidated' | 'general';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  transactions = [],
  selectedYear,
  selectedMonth,
  onSelectPeriod,
  availableYears,
  darkMode,
  setDarkMode,
  isRefreshing,
  onRefresh,
  onExportExcel,
  onExportPdf,
  onSaveSettings,
  onResetAll,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [formData, setFormData] = useState<ProjectSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [consolidatedSearch, setConsolidatedSearch] = useState('');

  const sym = formData.currencySymbol || '$';

  // Multi-year consolidated summary
  const multiYearSummary = useMemo(
    () => computeMultiYearSummary(transactions),
    [transactions]
  );

  // Month counts and stats for currently selected year in settings
  const [inspectYear, setInspectYear] = useState<number>(selectedYear);

  const monthsStats = useMemo(() => {
    return MONTHS_ES.map((name, index) => {
      const monthNum = index + 1;
      const monthTx = filterTransactionsByPeriod(transactions, inspectYear, monthNum);
      const income = monthTx
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const expenses = monthTx
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const balance = income - expenses;

      return {
        monthNum,
        name,
        count: monthTx.length,
        income,
        expenses,
        balance,
      };
    });
  }, [transactions, inspectYear]);

  // Filtered consolidated transactions list for the ledger in settings
  const filteredConsolidatedTx = useMemo(() => {
    if (!consolidatedSearch.trim()) return transactions;
    const term = consolidatedSearch.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.title.toLowerCase().includes(term) ||
        tx.destination.toLowerCase().includes(term) ||
        (tx.notes && tx.notes.toLowerCase().includes(term))
    );
  }, [transactions, consolidatedSearch]);

  React.useEffect(() => {
    setFormData(settings);
    setInspectYear(selectedYear);
  }, [settings, selectedYear, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      onClose();
    } catch (err: any) {
      alert('Error al guardar ajustes: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // If not in modal mode, render without wrapper (handled by parent)
  return (
    <div
      id="settings-page"
      className={`w-full max-w-3xl mx-auto flex flex-col h-full`}
    >
      <div
        className={`w-full flex-1 flex flex-col ${
          darkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-700/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
              <Sliders className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Configuración y Periodos
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                Hojas por mes, consolidado histórico y ajustes generales
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Inside Settings */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-neutral-700/30 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-current hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Ajustes & Exportación</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consolidated')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'consolidated'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-current hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Consolidado Histórico</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('period')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'period'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-current hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Hojas por Mes ({selectedMonth ? `${MONTHS_ES[selectedMonth - 1]} ` : 'Año '}{selectedYear})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: HOJAS POR MES & FILTRO DE PERIODO */}
          {activeTab === 'period' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-current">
                    Seleccionar Periodo de Trabajo
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                    Elige el mes y año para ver y registrar movimientos en esa hoja contable.
                  </p>
                </div>
                {/* Year Picker */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-400">Año:</span>
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                    {availableYears.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setInspectYear(y);
                          onSelectPeriod(y, selectedMonth);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          inspectYear === y
                            ? 'bg-amber-500 text-neutral-950 shadow-sm'
                            : 'text-neutral-500 hover:text-current'
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* View All Year Option */}
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-400">
                  Hojas Mensuales del {inspectYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSelectPeriod(inspectYear, null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                    selectedYear === inspectYear && selectedMonth === null
                      ? 'bg-amber-500 text-neutral-950 border-amber-500 shadow-md shadow-amber-500/20'
                      : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {selectedYear === inspectYear && selectedMonth === null ? '✓ ' : ''}
                  Ver Todo el Año {inspectYear}
                </button>
              </div>

              {/* Grid of 12 Months */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {monthsStats.map((m) => {
                  const isCurrent =
                    inspectYear === new Date().getFullYear() &&
                    m.monthNum === new Date().getMonth() + 1;
                  const isSelected =
                    selectedYear === inspectYear && selectedMonth === m.monthNum;

                  return (
                    <button
                      key={m.monthNum}
                      type="button"
                      onClick={() => {
                        onSelectPeriod(inspectYear, m.monthNum);
                      }}
                      className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500 text-neutral-950 border-amber-500 shadow-lg shadow-amber-500/25 scale-[1.02]'
                          : darkMode
                          ? 'bg-neutral-950/60 border-neutral-800/90 hover:border-neutral-700 text-neutral-200'
                          : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300 text-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm sm:text-base font-extrabold">
                          {m.name}
                        </span>
                        {isCurrent && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                              isSelected
                                ? 'bg-neutral-950 text-amber-400'
                                : 'bg-amber-500/15 text-amber-500'
                            }`}
                          >
                            Actual
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold opacity-80">
                          <span>Movimientos:</span>
                          <span className="font-mono font-bold">{m.count}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono font-bold">
                          <span>Balance:</span>
                          <span
                            className={
                              isSelected
                                ? 'text-neutral-950 font-black'
                                : m.balance >= 0
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                            }
                          >
                            {m.balance >= 0 ? '+' : ''}
                            {formatCurrency(m.balance, sym)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-1.5 border-t border-current/15 flex items-center justify-between text-[11px] font-bold">
                        <span>{isSelected ? 'Hoja Activa ✓' : 'Abrir Hoja'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CONSOLIDADO HISTÓRICO MULTIANUAL */}
          {activeTab === 'consolidated' && (
            <div className="space-y-4 animate-fade-in">
              {/* All-time Summary Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-current">
                      Consolidado Global Histórico
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                      Acumulado total de todos los años registrados en el sistema
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500 text-neutral-950">
                    {transactions.length} movimientos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    className={`p-3.5 rounded-xl border ${
                      darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-400 block">INGRESOS HISTÓRICOS</span>
                    <span className="text-lg sm:text-xl font-black text-emerald-500 font-mono block mt-1">
                      +{formatCurrency(multiYearSummary.allTimeIncome, sym)}
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-400 block">GASTOS HISTÓRICOS</span>
                    <span className="text-lg sm:text-xl font-black text-rose-500 font-mono block mt-1">
                      -{formatCurrency(multiYearSummary.allTimeExpenses, sym)}
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-400 block">BALANCE NETO GLOBAL</span>
                    <span
                      className={`text-lg sm:text-xl font-black font-mono block mt-1 ${
                        multiYearSummary.allTimeBalance >= 0 ? 'text-amber-500' : 'text-rose-500'
                      }`}
                    >
                      {multiYearSummary.allTimeBalance >= 0 ? '+' : '-'}
                      {formatCurrency(multiYearSummary.allTimeBalance, sym)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Year Breakdown Table */}
              <div className="space-y-2">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-400">
                  Resumen por Años Registrados
                </span>
                <div className="space-y-2">
                  {multiYearSummary.years.map((y) => (
                    <div
                      key={y.year}
                      className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-xs">
                          {y.year}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-current">Año {y.year}</p>
                          <p className="text-xs text-neutral-400">{y.txCount} transacciones en el año</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 font-mono text-xs sm:text-sm flex-wrap">
                        <span className="text-emerald-500 font-bold" title="Ingresos">
                          +{formatCurrency(y.totalIncome, sym)}
                        </span>
                        <span className="text-rose-500 font-bold" title="Gastos">
                          -{formatCurrency(y.totalExpenses, sym)}
                        </span>
                        <span
                          className={`font-black ${
                            y.netBalance >= 0 ? 'text-current' : 'text-rose-400'
                          }`}
                          title="Balance Neto"
                        >
                          = {formatCurrency(y.netBalance, sym)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ledger search */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-400">
                    Histórico de Movimientos
                  </span>
                  <span className="text-xs text-neutral-400">
                    {filteredConsolidatedTx.length} resultado(s)
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={consolidatedSearch}
                    onChange={(e) => setConsolidatedSearch(e.target.value)}
                    placeholder="Buscar en todo el histórico..."
                    className={`w-full pl-10 pr-4 py-2 rounded-xl border text-xs sm:text-sm outline-none ${
                      darkMode
                        ? 'bg-neutral-950 border-neutral-800 text-white placeholder-neutral-500'
                        : 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400'
                    }`}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {filteredConsolidatedTx.slice(0, 50).map((tx) => (
                    <div
                      key={tx.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        darkMode ? 'bg-neutral-950/40 border-neutral-800/80' : 'bg-white border-neutral-200'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate text-current">{tx.title}</p>
                        <p className="text-[11px] text-neutral-400 font-mono">
                          {tx.date} • {tx.destination}
                        </p>
                      </div>
                      <span
                        className={`font-mono font-extrabold flex-shrink-0 ${
                          tx.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'
                        }`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}
                        {formatCurrency(tx.amount, sym)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AJUSTES GENERALES, SOCIOS Y EXPORTACIONES */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-fade-in">
              {/* Quick Actions / Export */}
              <div className="p-3.5 rounded-2xl border border-neutral-700/30 bg-neutral-100 dark:bg-neutral-950/60 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block">
                  Exportaciones y Apariencia
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Export Excel */}
                  <button
                    id="settings-export-excel-btn"
                    type="button"
                    onClick={onExportExcel}
                    className="p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer bg-neutral-900 border-neutral-750 hover:bg-emerald-950/30 hover:border-emerald-600 text-emerald-400"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-extrabold">Exportar Excel (.xlsx)</p>
                      <p className="text-xs text-neutral-400 font-normal">Libro contable completo</p>
                    </div>
                  </button>

                  {/* Export PDF */}
                  <button
                    id="settings-export-pdf-btn"
                    type="button"
                    onClick={onExportPdf}
                    className="p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer bg-neutral-900 border-neutral-750 hover:bg-amber-950/30 hover:border-amber-600 text-amber-400"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-extrabold">Exportar Reporte PDF</p>
                      <p className="text-xs text-neutral-400 font-normal">Resumen y balance oficial</p>
                    </div>
                  </button>

                  {/* Sync */}
                  <button
                    id="settings-sync-refresh-btn"
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="p-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-3 transition-all cursor-pointer bg-neutral-900 border-neutral-750 text-neutral-200 hover:bg-neutral-800"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <RefreshCw
                        className={`w-4 h-4 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`}
                      />
                    </div>
                    <div className="text-left">
                      <p className="font-extrabold">Sincronizar Nube</p>
                      <p className="text-xs text-neutral-400 font-normal">Recargar datos al instante</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Form for Project & Partner Settings */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <div className="space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block">
                    Datos del Proyecto y Moneda
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block font-bold text-neutral-400 mb-1">
                        Nombre de la página o proyecto
                      </label>
                      <input
                        id="settings-project-name-input"
                        type="text"
                        value={formData.projectName}
                        onChange={(e) =>
                          setFormData({ ...formData, projectName: e.target.value })
                        }
                        placeholder="SISTEMA DE FINANZA"
                        className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold text-sm sm:text-base ${
                          darkMode
                            ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-neutral-400 mb-1">
                        Moneda (Código)
                      </label>
                      <input
                        type="text"
                        value={formData.currency}
                        onChange={(e) =>
                          setFormData({ ...formData, currency: e.target.value })
                        }
                        placeholder="COP, USD, EUR..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-mono uppercase font-bold ${
                          darkMode
                            ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-400 mb-1">
                        Símbolo
                      </label>
                      <input
                        type="text"
                        value={formData.currencySymbol}
                        onChange={(e) =>
                          setFormData({ ...formData, currencySymbol: e.target.value })
                        }
                        placeholder="$"
                        className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-mono font-black text-center text-base ${
                          darkMode
                            ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-bold text-neutral-400 mb-1">
                        Límite de Presupuesto Diario
                      </label>
                      <input
                        type="number"
                        value={formData.dailyBudget || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, dailyBudget: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="0"
                        className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold text-sm sm:text-base ${
                          darkMode
                            ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Reset All Option */}
                {/* Reset All Component Removed */}

                {/* Save Settings Button */}
                <div className="pt-3 border-t border-neutral-700/30 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-neutral-400 hover:text-current text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    id="save-settings-btn"
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center gap-2 shadow-md shadow-amber-500/20 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{isSaving ? 'Guardando...' : 'Guardar Ajustes'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
