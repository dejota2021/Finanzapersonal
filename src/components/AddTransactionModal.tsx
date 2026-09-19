import React, { useState, useEffect } from 'react';
import { X, Check, ArrowDownRight, ArrowUpRight, Calendar, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction, ProjectSettings, BudgetDestination } from '../types';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  settings: ProjectSettings;
  budgets: BudgetDestination[];
  defaultDate?: string;
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt'>, id?: string) => Promise<void>;
  onAddNewDestination?: (destName: string) => Promise<void>;
  darkMode: boolean;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  editingTransaction,
  settings,
  budgets,
  defaultDate,
  onSave,
  onAddNewDestination,
  darkMode,
}) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [destination, setDestination] = useState('');
  const [isCreatingNewDest, setIsCreatingNewDest] = useState(false);
  const [newDestInput, setNewDestInput] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setTitle(editingTransaction.title);
      setAmount(editingTransaction.amount.toString());
      setDestination(editingTransaction.destination);
      setIsCreatingNewDest(false);
      setDate(editingTransaction.date);
      setNotes(editingTransaction.notes || '');
      setShowAdvanced(!!editingTransaction.notes);
    } else {
      setType('expense');
      setTitle('');
      setAmount('');
      const defaultDest = budgets[0]?.destination || 'Proyecto';
      setDestination(defaultDest);
      setIsCreatingNewDest(budgets.length === 0);
      setNewDestInput('');
      setDate(defaultDate || new Date().toISOString().slice(0, 10));
      setNotes('');
      setShowAdvanced(false);
    }
  }, [editingTransaction, budgets, isOpen, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (!title.trim()) {
      alert('Por favor indica el concepto o detalle.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Por favor introduce un valor numérico válido mayor a 0.');
      return;
    }

    let finalDest = destination.trim();
    if (isCreatingNewDest) {
      finalDest = newDestInput.trim();
      if (!finalDest) {
        alert('Por favor escribe el nombre del destino o categoría.');
        return;
      }
      if (onAddNewDestination && !budgets.some((b) => b.destination.toLowerCase() === finalDest.toLowerCase())) {
        await onAddNewDestination(finalDest);
      }
    }

    if (!finalDest) {
      finalDest = 'General';
    }

    setIsSubmitting(true);
    try {
      await onSave(
        {
          type,
          title: title.trim(),
          amount: numAmount,
          destination: finalDest,
          isDeductible: false,
          deductiblePercentage: 0,
          paidBy: 'general',
          splitRatio: { general: 100 },
          date,
          notes: notes.trim(),
        },
        editingTransaction?.id
      );
      onClose();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="add-transaction-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="add-transaction-modal"
        className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl transition-all max-h-[92vh] overflow-y-auto ${
          darkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-700/30">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              {editingTransaction ? 'Editar Movimiento' : 'Nuevo Movimiento'}
            </h2>
            <p className="text-xs text-neutral-400">
              Registra el gasto o ingreso para sincronizarlo con el proyecto
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipo de Movimiento: Gasto vs Ingreso */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="type-expense-btn"
              onClick={() => setType('expense')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                type === 'expense'
                  ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-sm'
                  : darkMode
                  ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Gasto (-)</span>
            </button>
            <button
              type="button"
              id="type-income-btn"
              onClick={() => setType('income')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                type === 'income'
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-sm'
                  : darkMode
                  ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Ingreso (+)</span>
            </button>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-bold mb-1">
              {type === 'expense' ? '¿En qué nos lo gastamos?' : 'Concepto del Ingreso'}{' '}
              <span className="text-rose-400">*</span>
            </label>
            <input
              id="transaction-title-input"
              type="text"
              required
              placeholder={type === 'expense' ? 'Ej: Cables de audio, Sala de ensayo, Equipos, Transporte...' : 'Ej: Cobro concierto, Aporte inicial, Regalías...'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm border outline-none font-medium transition-colors ${
                darkMode
                  ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
              }`}
            />
          </div>

          {/* Monto & Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">
                ¿Cuánto? ({settings.currencySymbol}) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-400">
                  {settings.currencySymbol}
                </span>
                <input
                  id="transaction-amount-input"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full pl-8 pr-3.5 py-2 rounded-xl text-sm font-mono font-bold border outline-none ${
                    darkMode
                      ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Fecha</span>
              </label>
              <input
                id="transaction-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none ${
                  darkMode
                    ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                }`}
              />
            </div>
          </div>

          {/* Destino / Categoría */}
          <div className="p-3 rounded-xl border border-neutral-700/40 bg-neutral-800/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>¿Cuál fue el destino / categoría?</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewDest(!isCreatingNewDest)}
                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isCreatingNewDest ? '← Elegir de la lista' : '+ Crear nuevo destino'}
              </button>
            </div>

            {isCreatingNewDest || budgets.length === 0 ? (
              <div className="space-y-1">
                <input
                  id="custom-destination-input"
                  type="text"
                  placeholder="Escribe tu destino (ej: Equipos, Ensayos, Publicidad, Transporte)..."
                  value={newDestInput}
                  onChange={(e) => setNewDestInput(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none font-semibold ${
                    darkMode
                      ? 'bg-neutral-950 border-amber-500/60 text-white focus:border-amber-400'
                      : 'bg-white border-amber-400 text-neutral-900 focus:border-amber-500'
                  }`}
                />
                <p className="text-[10px] text-neutral-400">
                  Se guardará como destino para futuros movimientos.
                </p>
              </div>
            ) : (
              <select
                id="transaction-destination-select"
                value={destination}
                onChange={(e) => {
                  if (e.target.value === '__CREATE_NEW__') {
                    setIsCreatingNewDest(true);
                  } else {
                    setDestination(e.target.value);
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-semibold ${
                  darkMode
                    ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-amber-500'
                }`}
              >
                {budgets.map((b) => (
                  <option key={b.id} value={b.destination}>
                    {b.destination}
                  </option>
                ))}
                <option value="__CREATE_NEW__">+ Crear otro destino...</option>
              </select>
            )}
          </div>

          {/* Opciones Adicionales (Notas) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 font-semibold transition-colors cursor-pointer"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showAdvanced ? 'Ocultar notas adicionales' : 'Opciones adicionales (notas y detalles)'}</span>
            </button>
            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl border border-neutral-700/40 bg-neutral-950/40 space-y-3 animate-fade-in text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-neutral-400">Notas / Detalles</label>
                  <input
                    type="text"
                    placeholder="Detalles sobre el movimiento o comprobante..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-700/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="save-transaction-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Movimiento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
