export type YM = `${number}-${string}`;

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function ymFromDate(date: Date): YM {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  return `${y}-${m}`;
}

export function ymAdd(ym: YM, deltaMonths: number): YM {
  const [yStr, mStr] = ym.split('-');
  const y0 = Number(yStr);
  const m0 = Number(mStr) - 1;
  const d = new Date(Date.UTC(y0, m0 + deltaMonths, 1, 12, 0, 0));
  return ymFromDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function monthLabelFr(ym: YM) {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

export function monthLabelShortFr(ym: YM) {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(date);
}

export function daysInMonth(ym: YM) {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  return new Date(y, m, 0).getDate();
}

export function dueDateIso(ym: YM, dayOfMonth: number) {
  const day = Math.max(1, Math.min(dayOfMonth, daysInMonth(ym)));
  return `${ym}-${pad2(day)}`;
}
