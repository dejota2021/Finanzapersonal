import { jsPDF } from 'jspdf';
import { ProjectFinanceState } from '../types';
import { computeFinancials } from './calculations';

export function exportToPdf(state: ProjectFinanceState) {
  const { settings, transactions, budgets } = state;
  const financials = computeFinancials(transactions, budgets, settings);
  const projectName = settings.projectName?.trim() || 'Proyecto';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Accent line
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 39, pageWidth, 1.2, 'F');

  // Header Typography
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(projectName.toUpperCase(), margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(212, 212, 216);
  doc.text(
    `REPORTE DE ESTADO FINANCIERO  |  ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}`,
    margin,
    25
  );

  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text(
    `Moneda: ${settings.currency} (${settings.currencySymbol})  |  Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    margin,
    32
  );

  let curY = 48;

  // KPI Grid
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 22;
  const kpis = [
    { label: 'INGRESOS TOTALES', val: `+${settings.currencySymbol}${financials.totalIncome.toLocaleString('es-CO')}`, bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'GASTOS TOTALES', val: `-${settings.currencySymbol}${financials.totalExpenses.toLocaleString('es-CO')}`, bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'BALANCE NETO', val: `${settings.currencySymbol}${financials.netBalance.toLocaleString('es-CO')}`, bg: [239, 246, 255], border: [59, 130, 246], text: [30, 64, 175] },
    { label: 'MOVIMIENTOS', val: `${transactions.length}`, bg: [254, 252, 232], border: [234, 179, 8], text: [133, 77, 14] },
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, curY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(113, 113, 122);
    doc.text(kpi.label, x + 3, curY + 6);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.val, x + 3, curY + 14);
  });

  curY += cardHeight + 8;

  // Destinations Breakdown
  if (financials.destinationProgress.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(24, 24, 27);
    doc.text('DISTRIBUCIÓN POR DESTINOS', margin, curY);
    curY += 4;

    const budgetColWidth = (pageWidth - margin * 2 - 6) / 2;
    financials.destinationProgress.slice(0, 6).forEach((bp, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const itemX = margin + col * (budgetColWidth + 6);
      const itemY = curY + row * 8.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(39, 39, 42);
      doc.text(bp.destination, itemX, itemY + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(113, 113, 122);
      const spentText = `${settings.currencySymbol}${bp.spent.toLocaleString('es-CO')}`;
      doc.text(spentText, itemX + budgetColWidth - doc.getTextWidth(spentText), itemY + 3);

      doc.setFillColor(228, 228, 231);
      doc.roundedRect(itemX, itemY + 4.5, budgetColWidth, 2, 1, 1, 'F');
      const fillWidth = Math.min((bp.spent / (bp.limit || 1)) * budgetColWidth, budgetColWidth);
      doc.setFillColor(245, 158, 11);
      if (fillWidth > 0) {
        doc.roundedRect(itemX, itemY + 4.5, fillWidth, 2, 1, 1, 'F');
      }
    });

    curY += Math.ceil(Math.min(financials.destinationProgress.length, 6) / 2) * 8.5 + 4;
  }

  // Transactions Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(24, 24, 27);
  doc.text('DETALLE DE MOVIMIENTOS RECIENTES', margin, curY);
  curY += 4;

  doc.setFillColor(39, 39, 42);
  doc.rect(margin, curY, pageWidth - margin * 2, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA', margin + 2, curY + 4.2);
  doc.text('TIPO', margin + 20, curY + 4.2);
  doc.text('CONCEPTO / DETALLE', margin + 40, curY + 4.2);
  doc.text('DESTINO', margin + 110, curY + 4.2);
  doc.text('MONTO', pageWidth - margin - 22, curY + 4.2);
  curY += 6.5;

  const recentTx = transactions.slice(0, 16);
  recentTx.forEach((tx, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 250 : 255, isEven ? 250 : 255, isEven ? 250 : 255);
    doc.rect(margin, curY, pageWidth - margin * 2, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(63, 63, 70);
    doc.text(tx.date, margin + 2, curY + 4);

    if (tx.type === 'income') {
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.text('INGRESO', margin + 20, curY + 4);
    } else {
      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      doc.text('GASTO', margin + 20, curY + 4);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(24, 24, 27);
    doc.text(tx.title.substring(0, 42), margin + 40, curY + 4);
    doc.text(tx.destination.substring(0, 24), margin + 110, curY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(tx.type === 'income' ? 22 : 185, tx.type === 'income' ? 101 : 28, tx.type === 'income' ? 52 : 28);
    const amtStr = `${tx.type === 'income' ? '+' : '-'}${settings.currencySymbol}${Number(tx.amount).toLocaleString('es-CO')}`;
    doc.text(amtStr, pageWidth - margin - 2, curY + 4, { align: 'right' });
    curY += 6;
  });

  // Footer
  const footerY = pageHeight - 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(161, 161, 170);
  doc.text(`Documento generado electrónicamente - ${projectName}`, pageWidth / 2, footerY, { align: 'center' });

  const cleanName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanName || 'Reporte'}_Finanzas_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
