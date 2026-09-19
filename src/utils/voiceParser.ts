import { BudgetDestination, Partner } from '../types';

export interface ParsedVoiceResult {
  title: string;
  amount: number;
  type: 'expense' | 'income';
  destination: string;
  paidByPartnerId: string;
  splitPartner1: number;
  splitPartner2: number;
  notes: string;
  suggestedDestinations: string[];
}

/**
 * High-accuracy Spanish Voice NLP Parser with support for:
 * - Number words in millions, thousands, hundreds
 * - Colombian / Latin American financial colloquialisms ("palos", "lucas", "efectivo", "abono")
 * - Smart extraction of concepts, amounts, and destinations
 */
export function parseVoiceInput(
  rawText: string,
  existingBudgets: BudgetDestination[] = [],
  partners: Partner[] = []
): ParsedVoiceResult {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();
  const p1 = partners[0] || { id: 'socio-1', name: 'Socio 1' };
  const p2 = partners[1] || { id: 'socio-2', name: 'Socio 2' };

  // 1. AMOUNT DETECTION
  let amount = 0;

  // A. Check for Colombian slang: "palos" = millions (e.g., "11 palos" -> 11,000,000, "2 palos" -> 2,000,000)
  const palosMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*palos?\b/i);
  if (palosMatch) {
    amount = Math.round(parseFloat(palosMatch[1].replace(',', '.')) * 1000000);
  }

  // B. Check for Colombian slang: "lucas" = thousands (e.g., "50 lucas" -> 50,000)
  if (amount === 0) {
    const lucasMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*lucas?\b/i);
    if (lucasMatch) {
      amount = Math.round(parseFloat(lucasMatch[1].replace(',', '.')) * 1000);
    }
  }

  // C. Formatted numbers with commas or dots for thousands & millions
  // e.g. "5,000,000", "5.000.000", "500,000", "500.000", "11,000,000", "11.000.000", "50,000", "1,500,000"
  if (amount === 0) {
    const formattedMatch = lower.match(/(?:\$\s*)?\b(\d{1,3}(?:[,.]\d{3})+)\b/);
    if (formattedMatch) {
      const cleanVal = formattedMatch[1].replace(/[,.]/g, '');
      const parsed = parseInt(cleanVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
  }

  // D. Plain large digits (e.g. "5000000", "11000000", "500000", "80000")
  if (amount === 0) {
    const plainLargeDigits = lower.match(/(?:\$\s*)?\b(\d{4,12})\b/);
    if (plainLargeDigits) {
      amount = parseInt(plainLargeDigits[1], 10);
    }
  }

  // E. Digits with "millones" (e.g., "11 millones", "1.5 millones", "11,5 millones")
  if (amount === 0) {
    const digitMillionsMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*mill[oó]n(?:es)?\b/i);
    if (digitMillionsMatch) {
      const val = parseFloat(digitMillionsMatch[1].replace(',', '.'));
      amount = Math.round(val * 1000000);
      // Check if followed by thousands e.g. "2 millones 500 mil"
      const extraThousandsMatch = lower.match(/mill[oó]n(?:es)?\s*(?:con|y)?\s*(\d+(?:[.,]\d+)?)\s*mil\b/i);
      if (extraThousandsMatch) {
        amount += Math.round(parseFloat(extraThousandsMatch[1].replace(',', '.')) * 1000);
      }
    }
  }

  // D. Word numbers for millions (e.g. "once millones", "dos millones y medio", "veinte millones")
  if (amount === 0) {
    const wordMillionsMap: [RegExp, number][] = [
      [/\bcien\s*millones\b/i, 100000000],
      [/\bcincuenta\s*millones\b/i, 50000000],
      [/\bcuarenta\s*millones\b/i, 40000000],
      [/\btreinta\s*millones\b/i, 30000000],
      [/\bveinticinco\s*millones\b/i, 25000000],
      [/\bveinte\s*millones\b/i, 20000000],
      [/\bdiecinueve\s*millones\b/i, 19000000],
      [/\bdieciocho\s*millones\b/i, 18000000],
      [/\bdiecisiete\s*millones\b/i, 17000000],
      [/\bdiecis[eé]is\s*millones\b/i, 16000000],
      [/\bquince\s*millones\b/i, 15000000],
      [/\bcatorce\s*millones\b/i, 14000000],
      [/\btrece\s*millones\b/i, 13000000],
      [/\bdoce\s*millones\b/i, 12000000],
      [/\bonce\s*millones\b/i, 11000000],
      [/\bdiez\s*millones\b/i, 10000000],
      [/\bnueve\s*millones\b/i, 9000000],
      [/\bocho\s*millones\b/i, 8000000],
      [/\bsiete\s*millones\b/i, 7000000],
      [/\bseis\s*millones\b/i, 6000000],
      [/\bcinco\s*millones\b/i, 5000000],
      [/\bcuatro\s*millones\b/i, 4000000],
      [/\btres\s*millones\b/i, 3000000],
      [/\bdos\s*millones\b/i, 2000000],
      [/\b(?:un|uno|una)\s*mill[oó]n\b/i, 1000000],
      [/\bmedio\s*mill[oó]n\b/i, 500000],
    ];
    for (const [re, val] of wordMillionsMap) {
      if (re.test(lower)) {
        amount = val;
        // Check for "y medio"
        if (/\bmill[oó]n(?:es)?\s*y\s*medio\b/i.test(lower)) {
          amount += 500000;
        }
        // Check for thousands addition like "y quinientos mil"
        const extraMatch = lower.match(/\bmill[oó]n(?:es)?\s*(?:con|y)?\s*(\d+)\s*mil\b/i);
        if (extraMatch) {
          amount += parseInt(extraMatch[1], 10) * 1000;
        }
        break;
      }
    }
  }

  // E. Digits with "mil" (e.g. "500 mil", "80 mil", "250 mil", "15 mil")
  if (amount === 0) {
    const digitThousandsMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*mil\b/i);
    if (digitThousandsMatch) {
      const val = parseFloat(digitThousandsMatch[1].replace(',', '.'));
      amount = Math.round(val * 1000);
      // Check for hundreds after mil e.g. "500 mil 200"
      const extraHundreds = lower.match(/\bmil\s*(?:con|y)?\s*(\d{1,3})\b(?!\s*mil|\s*mill)/i);
      if (extraHundreds) {
        amount += parseInt(extraHundreds[1], 10);
      }
    }
  }

  // F. Words with "mil"
  if (amount === 0) {
    const wordThousandsMap: [RegExp, number][] = [
      [/\bnovecientos\s*mil\b/i, 900000],
      [/\bochocientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 850000 : 800000],
      [/\bsetecientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 750000 : 700000],
      [/\bseiscientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 650000 : 600000],
      [/\bquinientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 550000 : 500000],
      [/\bcuatrocientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 450000 : 400000],
      [/\btrescientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 350000 : 300000],
      [/\bdoscientos\s*(?:y\s*cincuenta\s*)?mil\b/i, lower.includes('cincuenta') ? 250000 : 200000],
      [/\bciento\s*cincuenta\s*mil\b/i, 150000],
      [/\bciento?\s*mil\b/i, 100000],
      [/\bnoventa\s*mil\b/i, 90000],
      [/\bochenta\s*mil\b/i, 80000],
      [/\bsetenta\s*mil\b/i, 70000],
      [/\bsesenta\s*mil\b/i, 60000],
      [/\bcincuenta\s*mil\b/i, 50000],
      [/\bcuarenta\s*mil\b/i, 40000],
      [/\btreinta\s*mil\b/i, 30000],
      [/\bveinticinco\s*mil\b/i, 25000],
      [/\bveinte\s*mil\b/i, 20000],
      [/\bquince\s*mil\b/i, 15000],
      [/\bdiez\s*mil\b/i, 10000],
      [/\bnueve\s*mil\b/i, 9000],
      [/\bocho\s*mil\b/i, 8000],
      [/\bsiete\s*mil\b/i, 7000],
      [/\bseis\s*mil\b/i, 6000],
      [/\b(?:cincomil|cinco\s*mil)\b/i, 5000],
      [/\bcuatro\s*mil\b/i, 4000],
      [/\btres\s*mil\b/i, 3000],
      [/\bdos\s*mil\b/i, 2000],
      [/\b(?:un\s*)?mil\b(?!\s*millones)/i, 1000],
    ];
    for (const [re, val] of wordThousandsMap) {
      if (re.test(lower)) {
        amount = val;
        break;
      }
    }
  }

  // G. Dot-formatted thousands/millions e.g. "11.000.000", "500.000", "2.500.000"
  if (amount === 0) {
    const dottedMatch = lower.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
    if (dottedMatch) {
      amount = parseFloat(dottedMatch[1].replace(/\./g, ''));
    }
  }

  // H. Standard raw numeric digits
  if (amount === 0) {
    const rawDigitsMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\b/);
    if (rawDigitsMatch) {
      const parsed = parseFloat(rawDigitsMatch[1].replace(',', '.'));
      amount = parsed;
    }
  }

  // 2. TYPE DETECTION (Income vs Expense)
  const isIncome = /\b(ingres(?:aron|ó|an|o|os)|recib(?:imos|ó|ieron|e)|entr(?:aron|ó|an)|cobr(?:amos|ó|ar|o|os)|ganan(?:cia|amos)|aporte[s]?|aport(?:ó|aron)|abon(?:o|os|aron)|ventas?|factur(?:amos|ó)|nos\s+pagaron)\b/i.test(lower);
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // 3. PARTNER DETECTION
  let paidByPartnerId = p1.id;
  if (p2.name && (new RegExp(`\\b${p2.name}\\b`, 'i').test(lower) || /\bdavid\b/i.test(lower))) {
    paidByPartnerId = p2.id;
  } else if (p1.name && (new RegExp(`\\b${p1.name}\\b`, 'i').test(lower) || /\bmarcelo\b/i.test(lower))) {
    paidByPartnerId = p1.id;
  }

  // 4. CLEANING CONCEPT & TITLE
  let cleanText = text
    .replace(/^(?:se\s+)?(?:ingresaron|ingresó|ingreso|ingresan|entraron|entró|recibimos|recibó|gastamos|me\s+gasté|se\s+gastó|se\s+pagaron|pagamos|pagué|compramos|compró|costó|un\s+cobro\s+de|un\s+pago\s+de|un\s+gasto\s+de|aporte\s+de|abono\s+de|por\s+favor\s+anota|registra|anota)\s+/i, '')
    .replace(/(?:\$\s*)?\b\d{1,3}(?:[,.]\d{3})+\b(?:\s*de\s*pesos)?/gi, '')
    .replace(/(?:once|\d+(?:[.,]\d+)?)\s*mill[oó]n(?:es)?(?:\s*de\s*pesos)?/gi, '')
    .replace(/\b(?:un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)\s*millones?(?:\s*de\s*pesos)?/gi, '')
    .replace(/(?:\d+(?:[.,]\d+)?)\s*palos?\b/gi, '')
    .replace(/(?:\d+(?:[.,]\d+)?)\s*lucas?\b/gi, '')
    .replace(/(?:\d+(?:[.,]\d+)?)\s*mil\b(?:\s*de\s*pesos)?/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
    .replace(/\b(?:pesos\s*colombianos|pesos|cop|d[oó]lares|usd)\b/gi, '')
    .replace(/\b(?:por\s*valor\s*de|de\s*valor)\b/gi, '')
    .replace(/\b(?:pagado\s*por\s*\w+|por\s*\w+)\b/gi, '')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Strip leading prefixes: "las de", "los de", "la de", "el de", "lo de", "un de", "una de"
  cleanText = cleanText.replace(/^(?:las|los|la|el|lo|un|una)\s+de\s+/i, '').trim();
  // Strip leading prepositions: "en", "de", "para", "por", "con"
  cleanText = cleanText.replace(/^(?:en|de|para|por|con)\s+/i, '').trim();

  // If user said "en efectivos para el proyecto" -> normalize to "Efectivo para el proyecto"
  cleanText = cleanText.replace(/\befectivos\b/gi, 'efectivo');

  if (!cleanText || cleanText.length < 2) {
    if (isIncome) {
      cleanText = 'Ingreso recibido';
    } else {
      cleanText = 'Gasto registrado';
    }
  }

  const title = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

  // 5. DESTINATION / CATEGORY SUGGESTIONS & EXTRACTION
  const suggestedDestinations: string[] = [];
  if (/proyecto/i.test(lower)) suggestedDestinations.push('Proyecto');
  if (/efectivo/i.test(lower)) suggestedDestinations.push('Efectivo');
  if (/producci[oó]n|master|mezcla|grabaci[oó]n|estudio/i.test(lower)) suggestedDestinations.push('Producción');
  if (/lanzamiento|marketing|publicidad|promo|redes/i.test(lower)) suggestedDestinations.push('Lanzamiento');
  if (/video|videoclip|clip|film/i.test(lower)) suggestedDestinations.push('Videoclip');
  if (/ensayo|sala/i.test(lower)) suggestedDestinations.push('Ensayos');
  if (/transporte|vi[aá]ticos|uber|taxi|gasolina/i.test(lower)) suggestedDestinations.push('Transporte');
  if (/almuerzo|comida|cena/i.test(lower)) suggestedDestinations.push('Alimentación');
  if (/equipo|instrumento|cable|micr[oó]fono/i.test(lower)) suggestedDestinations.push('Equipos');

  existingBudgets.forEach((b) => {
    if (lower.includes(b.destination.toLowerCase()) && !suggestedDestinations.includes(b.destination)) {
      suggestedDestinations.unshift(b.destination);
    }
  });

  if (!suggestedDestinations.includes('Proyecto')) suggestedDestinations.push('Proyecto');
  if (!suggestedDestinations.includes('Efectivo')) suggestedDestinations.push('Efectivo');
  if (!suggestedDestinations.includes('General')) suggestedDestinations.push('General');

  let destination = suggestedDestinations[0] || 'Proyecto';

  // Specific rule for "ingresaron 11 millones de pesos en efectivos para el proyecto":
  // User explicitly designated "para el proyecto"
  if (/para\s+el\s+proyecto/i.test(lower)) {
    destination = 'Proyecto';
  } else if (/en\s+efectivo/i.test(lower) && !suggestedDestinations.includes('Proyecto')) {
    destination = 'Efectivo';
  }

  return {
    title,
    amount,
    type,
    destination,
    paidByPartnerId,
    splitPartner1: 50,
    splitPartner2: 50,
    notes: `Nota de voz: "${text}"`,
    suggestedDestinations,
  };
}
