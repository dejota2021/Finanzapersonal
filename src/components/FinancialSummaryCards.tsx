import React from 'react';
import { Wallet, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { FinancialSummary, formatCurrency } from '../utils/calculations';
import { ProjectSettings } from '../types';

interface FinancialSummaryCardsProps {
  financials: FinancialSummary;
  settings: ProjectSettings;
  darkMode: boolean;
  onSettleBalance?: (fromPartnerId: string, toPartnerId: string, amount: number) => void;
  onOpenDestinations?: () => void;
}

export const FinancialSummaryCards: React.FC<FinancialSummaryCardsProps> = ({
  financials,
  settings,
  darkMode,
}) => {
  const { totalIncome, totalExpenses, netBalance } = financials;
  const sym = settings.currencySymbol || '$';

  return (
    <div id="financial-summary-section" className="space-y-3">
      {/* 3 Large, Highly Legible Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* 1. ¿Cuánto tenemos? (Saldo / Balance Neto) */}
        <div
          id="card-net-balance"
          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            darkMode
              ? 'bg-neutral-900/90 border-neutral-800 text-white'
              : 'bg-white border-neutral-200 text-neutral-950'
          } shadow-sm flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-400 dark:text-neutral-400">
              ¿Cuánto tenemos? (Saldo)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2.5">
            <span
              className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight font-mono block ${
                netBalance > 0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : netBalance < 0
                  ? 'text-rose-500 dark:text-rose-400'
                  : 'text-neutral-400'
              }`}
            >
              {netBalance >= 0 ? '+' : '-'}{formatCurrency(netBalance, sym)}
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-700/20 flex items-center justify-between text-xs sm:text-sm font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> +{formatCurrency(totalIncome, sym)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" /> -{formatCurrency(totalExpenses, sym)}
            </span>
          </div>
        </div>

        {/* 2. ¿Cuánto gastamos? (Total Egresos) */}
        <div
          id="card-total-expenses"
          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            darkMode
              ? 'bg-neutral-900/90 border-neutral-800 text-white'
              : 'bg-white border-neutral-200 text-neutral-950'
          } shadow-sm flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-400 dark:text-neutral-400">
              ¿Cuánto gastamos? (Total)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight font-mono text-rose-500 dark:text-rose-400 block">
              -{formatCurrency(totalExpenses, sym)}
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-700/20">
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              Suma acumulada de todos los egresos registrados
            </p>
          </div>
        </div>

        {/* 3. ¿Cuánto ingresamos? (Total Entradas) */}
        <div
          id="card-total-income"
          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            darkMode
              ? 'bg-neutral-900/90 border-neutral-800 text-white'
              : 'bg-white border-neutral-200 text-neutral-950'
          } shadow-sm flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-400 dark:text-neutral-400">
              ¿Cuánto ingresamos? (Entradas)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2.5">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight font-mono text-emerald-500 dark:text-emerald-400 block">
              +{formatCurrency(totalIncome, sym)}
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-700/20">
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              Fondos, cobros, ventas e ingresos del proyecto
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
