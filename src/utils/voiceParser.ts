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

export function extractAmountFromSpanishText(text: string): number {
  const clean = text.toLowerCase()
    .replace(/\b(?:pesos\s*colombianos|pesos|cop|d[oó]lares|usd|de\s*valor|por\s*valor\s*de)\b/g, '')
    .replace(/[^a-z0-9áéíóúüñ\s.,]/g, ' ')
    // Replace dots in thousands format e.g. 11.000.000 or 50.000 but NOT decimals like 1.5
    .replace(/(\d+)\.(\d{3})\b/g, '$1$2')
    .replace(/(\d+),(\d{3})\b/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();

  // Separate numbers from multipliers when mashed together, e.g., "50mil" -> "50 mil"
  let tokenized = clean
    .replace(/(\d+)(mil|mill[oó]n|palos?|lucas?)/gi, '$1 $2')
    .replace(/(mil|mill[oó]n|palos?|lucas?)(\d+)/gi, '$1 $2');

  const tokens = tokenized.split(/\s+/).filter(Boolean);

  const wordValues: { [key: string]: number } = {
    'cero': 0, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
    'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
    'dieciseis': 16, 'dieciséis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
    'veinte': 20, 'veintiuno': 21, 'veintiún': 21, 'veintiuna': 21,
    'veintidos': 22, 'veintidós': 22, 'veintitres': 23, 'veintitrés': 23,
    'veinticuatro': 24, 'veinticinco': 25, 'veintiseis': 26, 'veintiséis': 26,
    'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29,
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70,
    'ochenta': 80, 'noventa': 90,
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
    'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
    'setecientos': 700, 'ochocientos': 800, 'novecientos': 900
  };

  const multipliers: { [key: string]: number } = {
    'mil': 1000,
    'luca': 1000,
    'lucas': 1000,
    'millon': 1000000,
    'millón': 1000000,
    'millones': 1000000,
    'palo': 1000000,
    'palos': 1000000
  };

  let total = 0;
  let currentGroup = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Attempt standard decimal/integer parse
    const num = parseFloat(token.replace(',', '.'));
    if (!isNaN(num)) {
      currentGroup += num;
      continue;
    }

    if (token === 'y') {
      continue;
    }

    if (token === 'medio' || token === 'media') {
      if (i > 0 && (tokens[i - 1].includes('mill') || tokens[i - 1].includes('palo'))) {
        total += 500000;
      } else if (i > 0 && (tokens[i - 1] === 'mil' || tokens[i - 1].includes('luca'))) {
        total += 500;
      } else {
        currentGroup += 0.5;
      }
      continue;
    }

    if (wordValues[token] !== undefined) {
      currentGroup += wordValues[token];
      continue;
    }

    if (multipliers[token] !== undefined) {
      const mult = multipliers[token];
      if (currentGroup === 0) {
        currentGroup = 1;
      }
      
      if (mult === 1000000) {
        total += currentGroup * mult;
        currentGroup = 0;
      } else if (mult === 1000) {
        total += currentGroup * mult;
        currentGroup = 0;
      }
    }
  }

  total += currentGroup;
  return total;
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
  const amount = extractAmountFromSpanishText(lower);

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
