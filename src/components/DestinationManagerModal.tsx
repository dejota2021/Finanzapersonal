import React, { useState } from 'react';
import { X, Plus, Trash2, Tag, Check } from 'lucide-react';
import { BudgetDestination, ProjectSettings } from '../types';

interface DestinationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: BudgetDestination[];
  settings: ProjectSettings;
  onSaveBudgets: (updatedBudgets: BudgetDestination[]) => Promise<void>;
  darkMode: boolean;
}

const PALETTE = [
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#e11d48', // Rose
];

export const DestinationManagerModal: React.FC<DestinationManagerModalProps> = ({
  isOpen,
  onClose,
  budgets,
  settings,
  onSaveBudgets,
  darkMode,
}) => {
  const [items, setItems] = useState<BudgetDestination[]>(budgets);
  const [newDestName, setNewDestName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setItems(budgets);
  }, [budgets, isOpen]);

  if (!isOpen) return null;

  const handleAddDestination = () => {
    const trimmed = newDestName.trim();
    if (!trimmed) return;

    if (items.some((i) => i.destination.toLowerCase() === trimmed.toLowerCase())) {
      alert('Ya existe un destino con este nombre.');
      return;
    }

    const newItem: BudgetDestination = {
      id: `dest-${Date.now()}`,
      destination: trimmed,
      monthlyLimit: 0,
      color: selectedColor,
      iconName: 'Tag',
      description: 'Destino personalizado',
    };

    const updated = [...items, newItem];
    setItems(updated);
    setNewDestName('');
    // Better color cycling: get a random color not recently used, or just pick a random one
    const availableColors = PALETTE.filter((c) => !updated.some(item => item.color === c && item.id !== newItem.id));
    const randomColor = availableColors.length > 0 
      ? availableColors[Math.floor(Math.random() * availableColors.length)]
      : PALETTE[Math.floor(Math.random() * PALETTE.length)];
    setSelectedColor(randomColor);
  };

  const handleDeleteDestination = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveBudgets(items);
      onClose();
    } catch (err: any) {
      alert('Error al guardar destinos: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="destination-manager-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="destination-manager-modal"
        className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl transition-all max-h-[90vh] flex flex-col ${
          darkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-700/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Mis Destinos y Categorías</h2>
              <p className="text-xs text-neutral-400">Crea tus propias categorías para clasificar gastos e ingresos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Destination Form */}
        <div className="mt-4 p-3.5 rounded-xl border border-neutral-700/40 bg-neutral-800/30 space-y-3">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Nuevo Destino</span>
          </span>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <input
                id="new-destination-name-input"
                type="text"
                placeholder="Nombre (ej: Ensayos, Equipos, Transporte, etc.)..."
                value={newDestName}
                onChange={(e) => setNewDestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDestination();
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-medium ${
                  darkMode
                    ? 'bg-neutral-950 border-neutral-700 text-white focus:border-amber-500'
                    : 'bg-white border-neutral-300 text-neutral-900 focus:border-amber-500'
                }`}
              />
            </div>
          </div>

          {/* Color Selector */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400">Color:</span>
              <div className="flex items-center gap-1">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                      selectedColor === color
                        ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-neutral-900'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button
              id="add-destination-btn"
              type="button"
              onClick={handleAddDestination}
              disabled={!newDestName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>
        </div>

        {/* Existing Destinations List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[260px]">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold px-1">
            <span>Destinos Creados ({items.length})</span>
          </div>

          {items.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 border border-dashed border-neutral-700/50 rounded-xl">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
              <p className="text-xs font-semibold">Sin destinos personalizados aún</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Escribe un nombre arriba o créalo directamente al agregar un gasto.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                  darkMode ? 'bg-neutral-800/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 cursor-pointer hover:scale-125 transition-transform"
                    style={{ backgroundColor: item.color }}
                    onClick={() => {
                      const nextColorIndex = (PALETTE.indexOf(item.color) + 1) % PALETTE.length;
                      const newColor = PALETTE[nextColorIndex];
                      setItems(prev => prev.map(i => i.id === item.id ? {...i, color: newColor} : i));
                    }}
                    title="Hacer clic para cambiar color"
                  />
                  <span className="text-xs font-bold truncate">{item.destination}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteDestination(item.id)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                    title="Eliminar este destino"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-neutral-700/30 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
          >
            Cerrar
          </button>
          <button
            id="save-destinations-btn"
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Guardar Destinos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
