import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  ChevronDown,
  ChevronUp,
  Mic,
} from 'lucide-react';
import { FinancialSummary, formatCurrency } from '../utils/calculations';
import { ProjectSettings, Transaction } from '../types';

interface ChartsViewProps {
  financials: FinancialSummary;
  settings: ProjectSettings;
  transactions: Transaction[];
  darkMode: boolean;
  onOpenVoiceModal: () => void;
}

const COLOR_PALETTE = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#eab308', // yellow
];

export const ChartsView: React.FC<ChartsViewProps> = ({
  financials,
  settings,
  transactions,
  darkMode,
  onOpenVoiceModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const sym = settings.currencySymbol || '$';

  const { totalIncome, totalExpenses } = financials;

  // Data by destination/category
  const destSpending: { [dest: string]: number } = {};
  transactions.forEach((t) => {
    if (t.type === 'expense') {
      destSpending[t.destination] = (destSpending[t.destination] || 0) + Number(t.amount);
    }
  });

  const destinationsData = useMemo(() => {
    return Object.entries(destSpending)
      .map(([dest, amount], index) => {
        const budgetObj = financials.destinationProgress.find(
          (d) => d.destination.toLowerCase() === dest.toLowerCase()
        );
        return {
          name: dest,
          value: amount,
          color: budgetObj?.color || COLOR_PALETTE[index % COLOR_PALETTE.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [destSpending, financials.destinationProgress]);

  const topCategory = destinationsData[0];
  const savingsRate =
    totalIncome > 0
      ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
      : 0;

  return (
    <div
      id="charts-view-container"
      className={`p-4 sm:p-6 rounded-2xl border transition-all ${
        darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
      } shadow-sm space-y-4`}
    >
      {/* Header with Title and Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-current">
                  Análisis y Gráficos Visuales
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                Distribución de gastos por destino
              </p>
            </div>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl text-neutral-400 hover:text-current hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Colapsar gráficos' : 'Expandir gráficos'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Expanded Chart Content */}
      {isExpanded && (
        <div className="pt-2 animate-fade-in space-y-4">
          {/* Highlight stat badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div
              className={`p-3 rounded-xl border ${
                darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <span className="text-xs font-semibold text-neutral-400 block">Mayor Gasto</span>
              <p className="text-sm sm:text-base font-extrabold text-amber-500 truncate mt-0.5">
                {topCategory ? `${topCategory.name}` : 'Ninguno'}
              </p>
              {topCategory && (
                <span className="text-xs font-mono font-bold text-neutral-400">
                  {formatCurrency(topCategory.value, sym)}
                </span>
              )}
            </div>

            <div
              className={`p-3 rounded-xl border ${
                darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <span className="text-xs font-semibold text-neutral-400 block">Tasa de Excedente</span>
              <p className="text-sm sm:text-base font-extrabold text-emerald-500 mt-0.5">
                {savingsRate}%
              </p>
              <span className="text-xs text-neutral-400 font-medium">del total de ingresos</span>
            </div>

            <div
              className={`col-span-2 sm:col-span-1 p-3 rounded-xl border ${
                darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <span className="text-xs font-semibold text-neutral-400 block">Movimientos con Gastos</span>
              <p className="text-sm sm:text-base font-extrabold text-current font-mono mt-0.5">
                {transactions.filter((t) => t.type === 'expense').length} movimientos
              </p>
              <span className="text-xs text-neutral-400 font-medium">
                {destinationsData.length} destinos activos
              </span>
            </div>
          </div>

          {/* VIEW: POR DESTINO / CATEGORÍA (Donut + Progress bars) */}
          <div>
            {totalExpenses === 0 || destinationsData.length === 0 ? (
              <div className="py-12 text-center text-neutral-400">
                <PieIcon className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
                <p className="text-sm font-bold">Sin gastos registrados para graficar</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                  Al registrar tus gastos se agruparán automáticamente por destino.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Donut Chart with Total Spent in the center */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                  <div className="h-56 w-full max-w-[280px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={destinationsData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          stroke={darkMode ? '#171717' : '#ffffff'}
                          strokeWidth={3}
                        >
                          {destinationsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [
                            `${formatCurrency(Number(val), sym)} (${Math.round(
                              (Number(val) / (totalExpenses || 1)) * 100
                            )}%)`,
                            'Gastado',
                          ]}
                          contentStyle={{
                            backgroundColor: darkMode ? '#171717' : '#ffffff',
                            borderColor: darkMode ? '#333333' : '#e5e5e5',
                            borderRadius: '0.75rem',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: darkMode ? '#ffffff' : '#000000',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        Total Gastos
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-current">
                        {formatCurrency(totalExpenses, sym)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Destination Progress Bars and Details List */}
                <div className="lg:col-span-7 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-700/30 text-xs font-bold text-neutral-400">
                    <span>Destino / Categoría</span>
                    <span>Monto & Participación</span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1.5">
                    {destinationsData.map((item) => {
                      const percent =
                        totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0;
                      return (
                        <div
                          key={item.name}
                          className={`p-2.5 rounded-xl border transition-colors ${
                            darkMode
                              ? 'bg-neutral-950/50 border-neutral-800/80 hover:border-neutral-700'
                              : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-xs sm:text-sm font-bold truncate text-current">
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono flex-shrink-0">
                              <span className="text-xs sm:text-sm font-extrabold text-current">
                                {formatCurrency(item.value, sym)}
                              </span>
                              <span
                                className="text-[11px] font-extrabold px-1.5 py-0.2 rounded-md"
                                style={{
                                  backgroundColor: `${item.color}20`,
                                  color: item.color,
                                }}
                              >
                                {percent}%
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(3, percent))}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
