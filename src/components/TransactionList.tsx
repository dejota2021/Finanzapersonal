import React, { useState, useMemo, useEffect } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Trash2, Edit2, Calendar, Mic, Plus, Tag, Check, X, Settings } from 'lucide-react';
import { Transaction, ProjectSettings, BudgetDestination } from '../types';
import { formatCurrency } from '../utils/calculations';

interface TransactionListProps {
  transactions: Transaction[];
  settings: ProjectSettings;
  budgets: BudgetDestination[];
  darkMode: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onOpenVoiceModal: () => void;
  onOpenAddModal: () => void;
  onOpenDestinations: () => void;
  onOpenSettings: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  settings,
  budgets,
  darkMode,
  onEdit,
  onDelete,
  onOpenVoiceModal,
  onOpenAddModal,
  onOpenDestinations,
  onOpenSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => {
      setConfirmDeleteId(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const sym = settings.currencySymbol || '$';

  const allDestinations = useMemo(() => {
    const set = new Set<string>();
    budgets.forEach((b) => set.add(b.destination));
    transactions.forEach((t) => {
      if (t.destination) set.add(t.destination);
    });
    return Array.from(set);
  }, [budgets, transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          tx.title.toLowerCase().includes(term) ||
          tx.destination.toLowerCase().includes(term) ||
          (tx.notes && tx.notes.toLowerCase().includes(term));
        if (!matches) return false;
      }
      if (selectedDestination !== 'all' && tx.destination !== selectedDestination) {
        return false;
      }
      return true;
    });
  }, [transactions, searchTerm, selectedDestination]);

  const getDestinationColor = (destName: string) => {
    const found = budgets.find((b) => b.destination.toLowerCase() === destName.toLowerCase());
    return found?.color || '#f59e0b';
  };

  return (
    <div
      id="transactions-container"
      className={`p-4 sm:p-6 rounded-2xl border transition-all ${
        darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
      } shadow-sm space-y-4`}
    >
      {/* Header with Title and Quick Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-700/30">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight text-current">
              Movimientos y Libro Contable
            </h2>
            <span className="text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-current font-mono font-bold">
              {transactions.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-medium mt-0.5">
            Control de gastos e ingresos en tiempo real
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="manage-destinations-btn"
            type="button"
            onClick={onOpenDestinations}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors flex items-center gap-2 cursor-pointer ${
              darkMode
                ? 'bg-neutral-800/90 border-neutral-700 hover:bg-neutral-700 text-neutral-200'
                : 'bg-neutral-100 border-neutral-300 hover:bg-neutral-200 text-neutral-800'
            }`}
            title="Crear y organizar tus propios destinos"
          >
            <Tag className="w-4 h-4 text-amber-500" />
            <span>Destinos ({allDestinations.length})</span>
          </button>
          <button
            id="voice-note-add-btn"
            type="button"
            onClick={onOpenVoiceModal}
            className="hidden md:flex px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 transition-all items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            title="Hablar por micrófono para registrar automáticamente con IA"
          >
            <Mic className="w-4 h-4 stroke-[2.5]" />
            <span>Voz con IA</span>
          </button>
          <button
            id="manual-add-btn"
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Nuevo</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`hidden md:flex p-2.5 rounded-xl border transition-colors ${
              darkMode
                ? 'bg-neutral-800/90 border-neutral-700 hover:bg-neutral-700 text-neutral-200'
                : 'bg-neutral-100 border-neutral-300 hover:bg-neutral-200 text-neutral-800'
            }`}
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            id="search-transactions-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por concepto, destino o nota..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors ${
              darkMode
                ? 'bg-neutral-950/80 border-neutral-700 text-white placeholder-neutral-500 focus:border-amber-500'
                : 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-amber-500'
            }`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Destination Filter Dropdown */}
        <select
          id="filter-destination-select"
          value={selectedDestination}
          onChange={(e) => setSelectedDestination(e.target.value)}
          className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none cursor-pointer ${
            darkMode
              ? 'bg-neutral-950/80 border-neutral-700 text-neutral-200 focus:border-amber-500'
              : 'bg-neutral-50 border-neutral-300 text-neutral-800 focus:border-amber-500'
          }`}
        >
          <option value="all">Todos los destinos ({allDestinations.length})</option>
          {allDestinations.map((dest) => (
            <option key={dest} value={dest}>
              {dest}
            </option>
          ))}
        </select>
      </div>

      {/* Transaction Rows */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-14 text-center text-neutral-400 border border-dashed border-neutral-700/60 dark:border-neutral-800 rounded-2xl">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-base font-bold">No hay movimientos registrados</p>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-sm mx-auto">
              Pulsa <strong>+ Nuevo</strong> o <strong>Voz con IA</strong> para registrar tu primer gasto o ingreso.
            </p>
          </div>
        ) : (
          filtered.map((tx) => {
            const isExpense = tx.type === 'expense';
            const destColor = getDestinationColor(tx.destination);
            return (
              <div
                key={tx.id}
                id={`transaction-row-${tx.id}`}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  darkMode
                    ? 'bg-neutral-950/70 border-neutral-800/90 hover:border-neutral-700'
                    : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {/* Left: Indicator + Details */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isExpense
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-emerald-500/15 text-emerald-500'
                    }`}
                  >
                    {isExpense ? (
                      <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-extrabold truncate text-current">
                        {tx.title}
                      </h3>
                      {tx.voiceRecorded && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          <Mic className="w-3 h-3" /> Voz IA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-neutral-400 font-medium flex-wrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs"
                        style={{
                          backgroundColor: `${destColor}20`,
                          color: destColor,
                          border: `1px solid ${destColor}40`,
                        }}
                      >
                        <Tag className="w-3 h-3" />
                        <span>{tx.destination}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{tx.date}</span>
                      </span>
                    </div>
                    {tx.notes && (
                      <p className="text-xs sm:text-sm text-neutral-400 italic mt-0.5">
                        {tx.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Edit/Delete Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/40">
                  <span
                    className={`text-base sm:text-lg lg:text-xl font-black tracking-tight font-mono ${
                      isExpense ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'
                    }`}
                  >
                    {isExpense ? '-' : '+'}{formatCurrency(tx.amount, sym)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`edit-tx-${tx.id}`}
                      type="button"
                      onClick={() => onEdit(tx)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-current hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Editar movimiento"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {confirmDeleteId === tx.id ? (
                      <div className="flex items-center gap-1 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => onDelete(tx.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Confirmar eliminación"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Borrar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        id={`delete-tx-${tx.id}`}
                        type="button"
                        onClick={() => setConfirmDeleteId(tx.id)}
                        className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
