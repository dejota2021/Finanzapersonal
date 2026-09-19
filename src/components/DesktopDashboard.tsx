import React from 'react';
import { FinancialSummaryCards } from './FinancialSummaryCards';
import { ChartsView } from './ChartsView';
import { TransactionList } from './TransactionList';
import { Mic } from 'lucide-react';
import { ProjectFinanceState, Transaction, BudgetDestination, ProjectSettings } from '../types';

interface DesktopDashboardProps {
  state: ProjectFinanceState;
  financials: any;
  periodTransactions: Transaction[];
  darkMode: boolean;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenVoiceModal: () => void;
  onOpenAddModal: () => void;
  onOpenDestinations: () => void;
  onOpenSettings: () => void;
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  state,
  financials,
  periodTransactions,
  darkMode,
  onEditTransaction,
  onDeleteTransaction,
  onOpenVoiceModal,
  onOpenAddModal,
  onOpenDestinations,
  onOpenSettings,
}) => {
  return (
    <div className="hidden md:flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* 1. Summary Cards */}
      <FinancialSummaryCards
        financials={financials}
        settings={state.settings}
        darkMode={darkMode}
        onOpenDestinations={onOpenDestinations}
      />

      {/* 2. Analysis and Charts */}
      <div
        className={`p-6 rounded-3xl border ${
          darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
        } shadow-xl`}
      >
        <ChartsView
          financials={financials}
          settings={state.settings}
          transactions={periodTransactions}
          darkMode={darkMode}
          onOpenVoiceModal={onOpenVoiceModal}
        />
      </div>

      {/* 3. Transactions List */}
      <div
        className={`p-6 rounded-3xl border ${
          darkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
        } shadow-xl`}
      >
        <TransactionList
          transactions={periodTransactions}
          settings={state.settings}
          budgets={state.budgets}
          darkMode={darkMode}
          onEdit={onEditTransaction}
          onDelete={onDeleteTransaction}
          onOpenVoiceModal={onOpenVoiceModal}
          onOpenAddModal={onOpenAddModal}
          onOpenDestinations={onOpenDestinations}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
};
