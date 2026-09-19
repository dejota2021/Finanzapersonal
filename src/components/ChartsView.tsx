import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { FinancialSummary, formatCurrency } from '../utils/calculations';
import { ProjectSettings, Transaction } from '../types';

interface ChartsViewProps {
  financials: FinancialSummary;
  settings: ProjectSettings;
  transactions: Transaction[];
  darkMode: boolean;
}

type ChartTab = 'destinations' | 'cashflow';

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
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<ChartTab>('destinations');

  const sym = settings.currencySymbol || '$';
  const { totalIncome, totalExpenses, netBalance } = financials;

  // 1. Data by destination/category
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

  // 2. Data for Cash Flow (Income vs Expenses)
  const cashFlowData = useMemo(() => {
    return [
      {
        category: 'Flujo',
        Ingresos: totalIncome,
        Gastos: totalExpenses,
        Balance: Math.max(0, netBalance),
      },
    ];
  }, [totalIncome, totalExpenses, netBalance]);

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
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Interactivo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 font-medium">
              Distribución de gastos y flujo de fondos
            </p>
          </div>
        </div>

        {/* Action / View Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('destinations');
                setIsExpanded(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'destinations'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-500 hover:text-current'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Por Destino</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('cashflow');
                setIsExpanded(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cashflow'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-500 hover:text-current'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Entradas vs Gastos</span>
            </button>
          </div>

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

          {/* VIEW 1: POR DESTINO / CATEGORÍA (Donut + Progress bars) */}
          {activeTab === 'destinations' && (
            <div>
              {totalExpenses === 0 || destinationsData.length === 0 ? (
                <div className="py-12 text-center text-neutral-400">
                  <PieIcon className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
                  <p className="text-sm font-bold">Sin gastos registrados para graficar</p>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                    Al registrar tus gastos se agruparán automáticamente por destino con gráficos interactivos.
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
          )}

          {/* VIEW 2: FLUJO DE FONDOS (Ingresos vs Gastos) */}
          {activeTab === 'cashflow' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <XAxis dataKey="category" hide />
                    <YAxis
                      tick={{ fill: darkMode ? '#a3a3a3' : '#525252', fontSize: 12 }}
                      tickFormatter={(v) => formatCurrency(Number(v), sym)}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${formatCurrency(Number(val), sym)}`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: darkMode ? '#171717' : '#ffffff',
                        borderColor: darkMode ? '#333333' : '#e5e5e5',
                        borderRadius: '0.75rem',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: darkMode ? '#ffffff' : '#000000',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
                    <Bar dataKey="Ingresos" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Gastos" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cash Flow Summary Cards */}
              <div className="space-y-3">
                <div
                  className={`p-3.5 rounded-xl border ${
                    darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400">Total Ingresado</span>
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="text-xl font-black font-mono text-emerald-500 block mt-1">
                    +{formatCurrency(totalIncome, sym)}
                  </span>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400">Total Gastado</span>
                    <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-500">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="text-xl font-black font-mono text-rose-500 block mt-1">
                    -{formatCurrency(totalExpenses, sym)}
                  </span>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    darkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400">Balance Neto Disponible</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        netBalance >= 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {netBalance >= 0 ? 'Superávit' : 'Déficit'}
                    </span>
                  </div>
                  <span
                    className={`text-xl font-black font-mono block mt-1 ${
                      netBalance >= 0 ? 'text-amber-500' : 'text-rose-400'
                    }`}
                  >
                    {netBalance >= 0 ? '+' : '-'}{formatCurrency(netBalance, sym)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
