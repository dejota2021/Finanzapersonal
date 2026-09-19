import { Transaction, BudgetDestination, ProjectSettings, Partner } from '../types';

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  totalDeductible: number;
  estimatedTaxSavings: number;
  partner1Stats: {
    partner: Partner;
    totalPaid: number;
    totalReceived: number;
    requiredExpenseShare: number;
    netBalance: number;
  };
  partner2Stats: {
    partner: Partner;
    totalPaid: number;
    totalReceived: number;
    requiredExpenseShare: number;
    netBalance: number;
  };
  settlement: {
    debtorName: string;
    debtorId: string;
    creditorName: string;
    creditorId: string;
    amount: number;
    isBalanced: boolean;
  };
  destinationProgress: {
    destination: string;
    spent: number;
    limit: number;
    percent: number;
    color: string;
    iconName: string;
    isOverBudget: boolean;
  }[];
}

export function computeFinancials(
  transactions: Transaction[],
  budgets: BudgetDestination[],
  settings: ProjectSettings
): FinancialSummary {
  const [partner1, partner2] = settings.partners;
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalDeductible = 0;
  let p1PaidExpenses = 0;
  let p2PaidExpenses = 0;
  let p1ReceivedIncome = 0;
  let p2ReceivedIncome = 0;
  let p1RequiredExpenseShare = 0;
  let p2RequiredExpenseShare = 0;

  const spendingByDestination: { [key: string]: number } = {};

  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amount;
      if (tx.paidBy === partner1.id) {
        p1ReceivedIncome += amount;
      } else {
        p2ReceivedIncome += amount;
      }
    } else {
      totalExpenses += amount;
      spendingByDestination[tx.destination] = (spendingByDestination[tx.destination] || 0) + amount;
      if (tx.isDeductible) {
        const deductibleRate = (tx.deductiblePercentage ?? 100) / 100;
        totalDeductible += amount * deductibleRate;
      }
      if (tx.paidBy === partner1.id) {
        p1PaidExpenses += amount;
      } else {
        p2PaidExpenses += amount;
      }

      const p1Ratio = tx.splitRatio?.[partner1.id] !== undefined ? tx.splitRatio[partner1.id] : partner1.sharePercent;
      const p2Ratio = tx.splitRatio?.[partner2.id] !== undefined ? tx.splitRatio[partner2.id] : partner2.sharePercent;
      p1RequiredExpenseShare += amount * (p1Ratio / 100);
      p2RequiredExpenseShare += amount * (p2Ratio / 100);
    }
  });

  const netBalance = totalIncome - totalExpenses;
  const estimatedTaxSavings = totalDeductible * ((settings.taxRatePercent || 19) / 100);

  const p1ShareOfIncome = totalIncome * (partner1.sharePercent / 100);
  const p1OverallNet = (p1PaidExpenses - p1RequiredExpenseShare) + (p1ShareOfIncome - p1ReceivedIncome);
  const p2OverallNet = -p1OverallNet;

  const settlement = {
    debtorName: '',
    debtorId: '',
    creditorName: '',
    creditorId: '',
    amount: 0,
    isBalanced: true,
  };

  const diff = Math.abs(p1OverallNet);
  if (diff > 0.5) {
    settlement.isBalanced = false;
    settlement.amount = Math.round(diff * 100) / 100;
    if (p1OverallNet > 0) {
      settlement.creditorName = partner1.name;
      settlement.creditorId = partner1.id;
      settlement.debtorName = partner2.name;
      settlement.debtorId = partner2.id;
    } else {
      settlement.creditorName = partner2.name;
      settlement.creditorId = partner2.id;
      settlement.debtorName = partner1.name;
      settlement.debtorId = partner1.id;
    }
  }

  const destinationProgress = budgets.map((b) => {
    const spent = spendingByDestination[b.destination] || 0;
    const limit = b.monthlyLimit || 1;
    const percent = Math.min(Math.round((spent / limit) * 100), 200);
    return {
      destination: b.destination,
      spent,
      limit: b.monthlyLimit,
      percent,
      color: b.color,
      iconName: b.iconName,
      isOverBudget: b.monthlyLimit > 0 && spent > b.monthlyLimit,
    };
  });

  return {
    totalIncome,
    totalExpenses,
    netBalance,
    totalDeductible,
    estimatedTaxSavings,
    partner1Stats: {
      partner: partner1,
      totalPaid: p1PaidExpenses,
      totalReceived: p1ReceivedIncome,
      requiredExpenseShare: p1RequiredExpenseShare,
      netBalance: p1OverallNet,
    },
    partner2Stats: {
      partner: partner2,
      totalPaid: p2PaidExpenses,
      totalReceived: p2ReceivedIncome,
      requiredExpenseShare: p2RequiredExpenseShare,
      netBalance: p2OverallNet,
    },
    settlement,
    destinationProgress,
  };
}

export function formatCurrency(amount: number, symbol: string = '$'): string {
  const isInteger = Math.abs(amount) % 1 === 0;
  return `${symbol}${Math.abs(amount).toLocaleString('es-CO', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  })}`;
}

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function parseTxDate(dateStr: string): { year: number; month: number; day: number } {
  if (!dateStr) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
    }
  }
  const d = new Date(dateStr);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  year: number | null,
  month: number | null // 1 to 12 or null for entire year
): Transaction[] {
  return transactions.filter((tx) => {
    const { year: txYear, month: txMonth } = parseTxDate(tx.date);
    if (year !== null && txYear !== year) return false;
    if (month !== null && txMonth !== month) return false;
    return true;
  });
}

export function getAvailableYears(transactions: Transaction[]): number[] {
  const currentYear = new Date().getFullYear();
  const yearSet = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
  transactions.forEach((tx) => {
    const { year } = parseTxDate(tx.date);
    if (year > 1900 && year < 2100) {
      yearSet.add(year);
    }
  });
  return Array.from(yearSet).sort((a, b) => b - a); // descending
}

export interface YearStats {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  txCount: number;
  savingsRate: number; // percentage
  months: {
    monthIndex: number; // 1-12
    monthName: string;
    income: number;
    expenses: number;
    netBalance: number;
    txCount: number;
  }[];
}

export interface MultiYearSummary {
  allTimeIncome: number;
  allTimeExpenses: number;
  allTimeBalance: number;
  allTimeTxCount: number;
  years: YearStats[];
}

export function computeMultiYearSummary(transactions: Transaction[]): MultiYearSummary {
  const yearsList = getAvailableYears(transactions);
  let allTimeIncome = 0;
  let allTimeExpenses = 0;
  let allTimeTxCount = transactions.length;

  const years: YearStats[] = yearsList.map((y) => {
    let yearIncome = 0;
    let yearExpenses = 0;
    let yearTxCount = 0;

    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      return {
        monthIndex: monthNum,
        monthName: MONTHS_ES[i],
        income: 0,
        expenses: 0,
        netBalance: 0,
        txCount: 0,
      };
    });

    transactions.forEach((tx) => {
      const { year: txYear, month: txMonth } = parseTxDate(tx.date);
      if (txYear === y) {
        const amt = Number(tx.amount) || 0;
        yearTxCount += 1;
        if (tx.type === 'income') {
          yearIncome += amt;
          allTimeIncome += amt;
          if (txMonth >= 1 && txMonth <= 12) {
            months[txMonth - 1].income += amt;
          }
        } else {
          yearExpenses += amt;
          allTimeExpenses += amt;
          if (txMonth >= 1 && txMonth <= 12) {
            months[txMonth - 1].expenses += amt;
          }
        }
        if (txMonth >= 1 && txMonth <= 12) {
          months[txMonth - 1].txCount += 1;
        }
      }
    });

    months.forEach((m) => {
      m.netBalance = m.income - m.expenses;
    });

    const netBalance = yearIncome - yearExpenses;
    const savingsRate = yearIncome > 0 ? Math.round((netBalance / yearIncome) * 100) : 0;

    return {
      year: y,
      totalIncome: yearIncome,
      totalExpenses: yearExpenses,
      netBalance,
      txCount: yearTxCount,
      savingsRate,
      months,
    };
  });

  return {
    allTimeIncome,
    allTimeExpenses,
    allTimeBalance: allTimeIncome - allTimeExpenses,
    allTimeTxCount,
    years,
  };
}

