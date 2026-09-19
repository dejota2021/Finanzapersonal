import * as XLSX from 'xlsx';
import { ProjectFinanceState } from '../types';
import { computeFinancials } from './calculations';

export function exportToExcel(state: ProjectFinanceState) {
  const { settings, transactions, budgets } = state;
  const financials = computeFinancials(transactions, budgets, settings);
  const sym = settings.currencySymbol || '$';
  const projectName = settings.projectName?.trim() || 'Proyecto';

  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // HOJA 1: REGISTROS DETALLADOS
  // -------------------------------------------------------------
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const txSheetAoa: any[][] = [
    [`${projectName.toUpperCase()} - LIBRO CONTABLE DE REGISTROS`],
    [`Moneda: ${settings.currency} (${sym}) | Fecha: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`],
    [`Total de Movimientos: ${transactions.length}`],
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
    `Total de Registros: ${transactions.length}`,
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
    [`${projectName.toUpperCase()} - RESUMEN FINANCIERO`],
    ['Control integral de ingresos y gastos'],
    [],
    ['MÉTRICA', `VALOR (${settings.currency})`, 'DETALLE'],
    ['Saldo Neto Disponible', financials.netBalance, financials.netBalance >= 0 ? 'Fondo disponible' : 'Déficit'],
    ['Total Gastos Registrados', financials.totalExpenses, 'Erogaciones totales'],
    ['Total Ingresos Registrados', financials.totalIncome, 'Fondos y cobros totales'],
    ['Total de Movimientos', transactions.length, 'Registros activos'],
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
    summarySheetAoa.push(['(Sin destinos registrados)', 0, '0%', 'Sin actividad']);
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
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${cleanName || 'Finanzas'}_Registros_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
