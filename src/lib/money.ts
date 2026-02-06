export function eurosToCents(euros: number) {
  return Math.round(euros * 100);
}

export function centsToEuros(cents: number) {
  return cents / 100;
}

export function parseEuroAmount(raw: string): number | null {
  const s0 = raw.trim();
  if (!s0) return null;

  let s = s0
    // remove regular & non-breaking spaces
    .replace(/[\u00a0\u202f\s]/g, '')
    // strip common currency markers
    .replace(/\u20AC/g, '')
    .replace(/eur(?:os?)?$/i, '')
    // keep only digits, signs and separators
    .replace(/[^0-9.,+-]/g, '');

  if (!s) return null;

  const sign = s[0] === '-' || s[0] === '+' ? s[0] : '';
  if (sign) s = s.slice(1);
  // drop any extra signs
  s = s.replace(/[+-]/g, '');
  if (!s || !/[0-9]/.test(s)) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  const normalizeSingleSep = (sep: ',' | '.') => {
    const count = s.split(sep).length - 1;
    if (count === 0) return;
    if (count === 1) {
      s = s.replace(sep, '.');
      return;
    }

    const parts = s.split(sep);
    const last = parts[parts.length - 1] ?? '';
    const allGroups3 = parts.slice(1).every((p) => p.length === 3);
    const looksLikeThousands = last.length === 3 && allGroups3;
    const looksLikeDecimal = last.length > 0 && last.length <= 2;

    if (looksLikeThousands && !looksLikeDecimal) {
      s = parts.join('');
      return;
    }

    // Treat last group as decimals, remove other separators.
    const frac = parts.pop() ?? '';
    const intPart = parts.join('');
    s = intPart + (frac ? `.${frac}` : '');
  };

  if (hasComma && hasDot) {
    // Use the last occurrence as decimal separator, other as thousands.
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const dec: ',' | '.' = lastComma > lastDot ? ',' : '.';
    const thou: ',' | '.' = dec === ',' ? '.' : ',';
    s = s.replaceAll(thou, '');
    normalizeSingleSep(dec);
  } else if (hasComma) {
    normalizeSingleSep(',');
  } else if (hasDot) {
    normalizeSingleSep('.');
  }

  // tolerate trailing separator
  if (s.endsWith('.')) s = s.slice(0, -1);
  if (!s || !/[0-9]/.test(s)) return null;

  const n = Number(`${sign}${s}`);
  return Number.isFinite(n) ? n : null;
}

const EUR_FORMATTER = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

export function formatEUR(cents: number) {
  return EUR_FORMATTER.format(centsToEuros(cents));
}
