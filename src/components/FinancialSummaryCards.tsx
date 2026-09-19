import React from 'react';
import { Wallet, TrendingUp, TrendingDown, CalendarClock, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';
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

  // Daily budget limit configured in settings minus total expenses
  const dailyLimit = settings.dailyBudget || 0;
  const remainingDailyBudget = dailyLimit > 0 ? dailyLimit - totalExpenses : 0;
  const isBudgetExceeded = dailyLimit > 0 && remainingDailyBudget < 0;

  return (
    <div
      id="financial-summary-section"
      className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-3"
    >
      {/* 1. Saldo Neto */}
      <div
        id="card-net-balance"
        className={`w-full p-6 rounded-3xl border transition-all flex flex-row items-center justify-between gap-3 shadow-md ${
          darkMode
            ? 'bg-neutral-900/90 border-neutral-800/80 text-white'
            : 'bg-white border-neutral-200 text-neutral-950'
        }`}
      >
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 truncate w-full">
            Saldo Neto
          </span>
          <span
            className={`text-2xl sm:text-3xl font-black tracking-tight font-mono truncate w-full ${
              netBalance > 0
                ? 'text-emerald-400'
                : netBalance < 0
                ? 'text-rose-400'
                : 'text-neutral-400'
            }`}
          >
            {netBalance >= 0 ? '+' : '-'}{formatCurrency(netBalance, sym)}
          </span>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* 2. Total Gastos */}
      <div
        id="card-total-expenses"
        className={`w-full p-6 rounded-3xl border transition-all flex flex-row items-center justify-between gap-3 shadow-md ${
          darkMode
            ? 'bg-neutral-900/90 border-neutral-800/80 text-white'
            : 'bg-white border-neutral-200 text-neutral-950'
        }`}
      >
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 truncate w-full">
            Total Gastos
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight font-mono text-rose-400 truncate w-full">
            -{formatCurrency(totalExpenses, sym)}
          </span>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center flex-shrink-0">
          <TrendingDown className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* 3. Presupuesto Diario */}
      <div
        id="card-daily-budget"
        className={`w-full p-6 rounded-3xl border transition-all flex flex-row items-center justify-between gap-3 shadow-md ${
          darkMode
            ? 'bg-neutral-900/90 border-neutral-800/80 text-white'
            : 'bg-white border-neutral-200 text-neutral-950'
        }`}
      >
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 truncate w-full">
            Presupuesto Diario
          </span>
          <span
            className={`text-2xl sm:text-3xl font-black tracking-tight font-mono truncate w-full ${
              isBudgetExceeded
                ? 'text-rose-400'
                : remainingDailyBudget > 0
                ? 'text-amber-400'
                : 'text-neutral-400'
            }`}
          >
            {isBudgetExceeded ? '-' : ''}{formatCurrency(remainingDailyBudget, sym)}
          </span>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* 4. Total Ingresos */}
      <div
        id="card-total-income"
        className={`w-full p-6 rounded-3xl border transition-all flex flex-row items-center justify-between gap-3 shadow-md ${
          darkMode
            ? 'bg-neutral-900/90 border-neutral-800/80 text-white'
            : 'bg-white border-neutral-200 text-neutral-950'
        }`}
      >
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 truncate w-full">
            Total Ingresos
          </span>
          <span className="text-2xl sm:text-3xl font-black tracking-tight font-mono text-emerald-400 truncate w-full">
            +{formatCurrency(totalIncome, sym)}
          </span>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>
    </div>
  );
};
