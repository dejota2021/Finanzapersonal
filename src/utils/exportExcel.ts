import * as XLSX from 'xlsx';
import { ProjectFinanceState } from '../types';
import { computeFinancials } from './calculations';

export function exportToExcel(
  state: ProjectFinanceState,
  filterYear?: number | null,
  filterMonth?: number | null
) {
  const { settings, transactions, budgets } = state;
  const sym = settings.currencySymbol || '$';
  const projectName = settings.projectName?.trim() || 'Proyecto';

  const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Filter transactions based on period selection
  let filteredTransactions = [...transactions];
  let periodLabel = 'Todo el historial';

  if (filterYear) {
    if (filterMonth) {
      filteredTransactions = transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === filterYear && (d.getMonth() + 1) === filterMonth;
      });
      const monthName = MONTHS_ES[filterMonth - 1] || `Mes ${filterMonth}`;
      periodLabel = `${monthName} de ${filterYear}`;
    } else {
      filteredTransactions = transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === filterYear;
      });
      periodLabel = `Año ${filterYear}`;
    }
  }

  const financials = computeFinancials(filteredTransactions, budgets, settings);
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // HOJA 1: REGISTROS DETALLADOS
  // -------------------------------------------------------------
  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const txSheetAoa: any[][] = [
    [`${projectName.toUpperCase()} - LIBRO CONTABLE DE REGISTROS`],
    [`Periodo: ${periodLabel} | Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`],
    [`Total de Movimientos en Periodo: ${sortedTransactions.length}`],
    [],
    [
      'N°',
      'Fecha',
      'Tipo de Movimiento',
      'Concepto / Detalle',
      'Destino / Categoría',
      `Monto (${sym})`,
      `Ingreso (+)`,
      `Gasto (-)`,
      'Notas / Observaciones',
    ],
  ];

  let sumIncome = 0;
  let sumExpense = 0;

  sortedTransactions.forEach((t, index) => {
    const isExpense = t.type === 'expense';
    const amountNum = Number(t.amount) || 0;
    if (isExpense) sumExpense += amountNum;
    else sumIncome += amountNum;

    txSheetAoa.push([
      index + 1,
      t.date,
      isExpense ? 'GASTO' : 'INGRESO',
      t.title,
      t.destination,
      amountNum,
      isExpense ? 0 : amountNum,
      isExpense ? amountNum : 0,
      t.notes || '',
    ]);
  });

  // Fila de Totales
  txSheetAoa.push([]);
  txSheetAoa.push([
    'TOTALES',
    '',
    '',
    `Total de Registros: ${sortedTransactions.length}`,
    '',
    financials.netBalance,
    sumIncome,
    sumExpense,
    `Saldo Neto: ${sym}${financials.netBalance.toLocaleString('es-CO')}`,
  ]);

  const wsTransactions = XLSX.utils.aoa_to_sheet(txSheetAoa);
  wsTransactions['!cols'] = [
    { wch: 6 },
    { wch: 13 },
    { wch: 18 },
    { wch: 38 },
    { wch: 28 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Registros');

  // -------------------------------------------------------------
  // HOJA 2: RESUMEN Y DESTINOS
  // -------------------------------------------------------------
  const summarySheetAoa: any[][] = [
    [`${projectName.toUpperCase()} - RESUMEN FINANCIERO (${periodLabel})`],
    ['Control integral de ingresos y gastos'],
    [],
    ['MÉTRICA', `VALOR (${settings.currency})`, 'DETALLE'],
    ['Saldo Neto Disponible', financials.netBalance, financials.netBalance >= 0 ? 'Fondo disponible' : 'Déficit'],
    ['Total Gastos Registrados', financials.totalExpenses, 'Erogaciones totales'],
    ['Total Ingresos Registrados', financials.totalIncome, 'Fondos y cobros totales'],
    ['Total de Movimientos', sortedTransactions.length, 'Registros en este periodo'],
    [],
    ['DISTRIBUCIÓN POR DESTINO O CATEGORÍA'],
    ['Destino / Categoría', `Gastado (${sym})`, '% del Total', 'Estado'],
  ];

  if (financials.destinationProgress.length > 0) {
    financials.destinationProgress.forEach((dp) => {
      summarySheetAoa.push([
        dp.destination,
        dp.spent,
        `${dp.percent}%`,
        dp.limit > 0 && dp.spent > dp.limit ? 'Sobrepasado' : 'Conforme',
      ]);
    });
  } else {
    summarySheetAoa.push(['(Sin destinos registrados con actividad en este periodo)', 0, '0%', 'Sin actividad']);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetAoa);
  wsSummary['!cols'] = [
    { wch: 40 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  const cleanName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanName || 'Finanzas'}_${cleanPeriod}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
