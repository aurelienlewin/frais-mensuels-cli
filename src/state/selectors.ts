import { dueDateIso, pad2, type YM } from '../lib/date';
import type {
  Account,
  AccountId,
  AppState,
  Budget,
  BudgetExpense,
  ChargeDestination,
  ChargePayment,
  ChargeScope,
  MonthBudgetSnapshot,
  MonthChargeSnapshot,
  MonthData,
} from './types';

export type ChargeResolved = {
  id: string;
  name: string;
  amountCents: number;
  sortOrder: number;
  dayOfMonth: number;
  dueDate: string; // YYYY-MM-DD
  accountId: AccountId;
  accountName: string;
  scope: ChargeScope;
  splitPercent: number;
  payment: ChargePayment;
  destination: ChargeDestination | null;
  destinationLabel: string | null;
  paid: boolean;
  myShareCents: number;
};

export type BudgetResolved = {
  id: string;
  name: string;
  amountCents: number;
  accountId: AccountId;
  accountName: string;
  scope: ChargeScope;
  splitPercent: number;
  myShareCents: number;
  expenses: BudgetExpense[];
  spentCents: number;
  remainingCents: number;
};

function accountById(accounts: Account[]) {
  const map = new Map<AccountId, Account>();
  for (const a of accounts) map.set(a.id, a);
  return map;
}

export function getMonth(state: AppState, ym: YM): MonthData | null {
  return state.months[ym] ?? null;
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function resolveSnapshot(
  state: AppState,
  ym: YM,
  chargeId: string,
): { paid: boolean; snap: MonthChargeSnapshot | null } {
  const month = state.months[ym];
  const monthState = month?.charges[chargeId];
  if (monthState?.snapshot && month?.archived) return { paid: monthState.paid, snap: monthState.snapshot };

  const ch = state.charges.find((c) => c.id === chargeId);
  // Month-only charges (planned/one-off): stored as a snapshot in the month, not in global charges.
  if (!ch && monthState?.snapshot) return { paid: monthState.paid, snap: monthState.snapshot };
  const defaultPaid =
    !month?.archived &&
    !monthState &&
    ch?.payment === 'auto' &&
    dueDateIso(ym, ch?.dayOfMonth ?? 1) <= todayIsoLocal();
  const paid = monthState?.paid ?? defaultPaid ?? false;
  if (!ch) return { paid, snap: null };
  return {
    paid,
    snap: {
      name: ch.name,
      amountCents: ch.amountCents,
      sortOrder: ch.sortOrder,
      dayOfMonth: ch.dayOfMonth,
      accountId: ch.accountId,
      scope: ch.scope,
      splitPercent: ch.splitPercent,
      payment: ch.payment,
      destination: ch.destination,
    },
  };
}

export function chargesForMonth(state: AppState, ym: YM): ChargeResolved[] {
  const month = state.months[ym];
  const accounts = accountById(state.accounts);

  const ids: string[] = [];
  if (month?.archived) {
    for (const [id, st] of Object.entries(month.charges)) {
      if (st.snapshot && !st.removed) ids.push(id);
    }
  } else {
    for (const ch of state.charges) {
      if (!ch.active) continue;
      if (month?.charges[ch.id]?.removed) continue;
      ids.push(ch.id);
    }
  }

  // In non-archived months, keep any paid markers even if charge got deactivated.
  if (!month?.archived && month) {
    for (const id of Object.keys(month.charges)) {
      if (month.charges[id]?.removed) continue;
      if (!ids.includes(id)) ids.push(id);
    }
  }

  const rows: ChargeResolved[] = [];
  for (const id of ids) {
    const { paid, snap } = resolveSnapshot(state, ym, id);
    if (!snap) continue;
    const splitPercent =
      snap.scope === 'commun'
        ? typeof snap.splitPercent === 'number' && Number.isFinite(snap.splitPercent)
          ? Math.max(0, Math.min(100, Math.round(snap.splitPercent)))
          : 50
        : 100;
    const myShareCents = snap.scope === 'commun' ? Math.round((snap.amountCents * splitPercent) / 100) : snap.amountCents;
    const accName = accounts.get(snap.accountId)?.name ?? snap.accountId;
    const sortOrder = typeof (snap as { sortOrder?: unknown }).sortOrder === 'number' ? snap.sortOrder : 9999;
    const destination = snap.destination ?? null;
    const destinationLabel =
      destination?.kind === 'account'
        ? (accounts.get(destination.accountId)?.name ?? destination.accountId)
        : destination?.kind === 'text'
          ? destination.text
          : null;
    rows.push({
      id,
      name: snap.name,
      amountCents: snap.amountCents,
      sortOrder,
      dayOfMonth: snap.dayOfMonth,
      dueDate: dueDateIso(ym, snap.dayOfMonth),
      accountId: snap.accountId,
      accountName: accName,
      scope: snap.scope,
      splitPercent,
      payment: snap.payment,
      destination,
      destinationLabel,
      paid,
      myShareCents,
    });
  }

  const scopeOrder = (s: ChargeScope) => (s === 'commun' ? 0 : 1);
  rows.sort((a, b) => {
    const t = scopeOrder(a.scope) - scopeOrder(b.scope);
    if (t !== 0) return t;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth - b.dayOfMonth;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

function resolveBudgetSnapshot(
  state: AppState,
  ym: YM,
  budgetId: string,
): { expenses: BudgetExpense[]; snap: MonthBudgetSnapshot | null } {
  const month = state.months[ym];
  const monthState = month?.budgets[budgetId];
  const expenses = monthState?.expenses ?? [];
  if (month?.archived && monthState?.snapshot) return { expenses, snap: monthState.snapshot };

  const b = state.budgets.find((x) => x.id === budgetId);
  if (!b) return { expenses, snap: null };
  return { expenses, snap: { name: b.name, amountCents: b.amountCents, accountId: b.accountId, scope: b.scope, splitPercent: b.splitPercent } };
}

export function budgetsForMonth(state: AppState, ym: YM): BudgetResolved[] {
  const month = state.months[ym];
  const accounts = accountById(state.accounts);

  const ids: string[] = [];
  if (month?.archived) {
    for (const [id, st] of Object.entries(month.budgets)) {
      if (st.snapshot) ids.push(id);
    }
  } else {
    const enabledForMonth = (b: Budget) => {
      if (b.active) return true;
      const inactiveFromYm = b.inactiveFromYm;
      return typeof inactiveFromYm === 'string' ? ym < inactiveFromYm : false;
    };

    for (const b of state.budgets) {
      if (enabledForMonth(b)) ids.push(b.id);
    }

    // Keep month expenses visible even if envelope got deleted later.
    if (month) {
      for (const [id, st] of Object.entries(month.budgets)) {
        const hasExpenses = Boolean(st.expenses?.length);
        if (!hasExpenses) continue;
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }

  const rows: BudgetResolved[] = [];
  for (const id of ids) {
    const { expenses, snap } = resolveBudgetSnapshot(state, ym, id);
    if (!snap) continue;
    const spentCents = expenses.reduce((acc, e) => acc + e.amountCents, 0);
    const remainingCents = snap.amountCents - spentCents;
    const accName = accounts.get(snap.accountId)?.name ?? snap.accountId;
    const scope: ChargeScope = snap.scope === 'commun' ? 'commun' : 'perso';
    const splitPercent =
      scope === 'commun'
        ? typeof snap.splitPercent === 'number' && Number.isFinite(snap.splitPercent)
          ? Math.max(0, Math.min(100, Math.round(snap.splitPercent)))
          : 50
        : 100;
    const myShareCents = scope === 'commun' ? Math.round((snap.amountCents * splitPercent) / 100) : snap.amountCents;
    rows.push({
      id,
      name: snap.name,
      amountCents: snap.amountCents,
      accountId: snap.accountId,
      accountName: accName,
      scope,
      splitPercent,
      myShareCents,
      expenses,
      spentCents,
      remainingCents,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function totalsForMonth(state: AppState, ym: YM) {
  const rows = chargesForMonth(state, ym);
  const budgets = budgetsForMonth(state, ym);

  let totalCommunCents = 0;
  let totalCommunPartCents = 0;
  let totalPersoCents = 0;
  let totalPourMoiCents = 0;
  let pendingCount = 0;

  for (const r of rows) {
    if (!r.paid) pendingCount += 1;

    if (r.scope === 'commun') {
      totalCommunCents += r.amountCents;
      totalCommunPartCents += r.myShareCents;
    } else {
      totalPersoCents += r.amountCents;
    }
    totalPourMoiCents += r.scope === 'commun' ? r.myShareCents : r.amountCents;
  }

  const salaryCents = state.months[ym]?.salaryCents ?? state.salaryCents;
  const totalBudgetsCents = budgets.reduce((acc, b) => acc + b.myShareCents, 0);
  const totalBudgetSpentCents = budgets.reduce((acc, b) => acc + b.spentCents, 0);
  const totalPourMoiAvecEnveloppesCents = totalPourMoiCents + totalBudgetsCents;

  return {
    salaryCents,
    totalCommunCents,
    totalCommunPartCents,
    totalPersoCents,
    totalPourMoiCents,
    totalBudgetsCents,
    totalBudgetSpentCents,
    totalPourMoiAvecEnveloppesCents,
    resteAVivreCents: salaryCents - totalPourMoiCents,
    resteAVivreApresEnveloppesCents: salaryCents - totalPourMoiAvecEnveloppesCents,
    pendingCount,
    count: rows.length,
  };
}

export function totalsByAccount(state: AppState, ym: YM) {
  const rows = chargesForMonth(state, ym);
  const budgets = budgetsForMonth(state, ym);

  const byAccount = new Map<AccountId, { chargesTotalCents: number; chargesPaidCents: number; budgetsCents: number }>();
  for (const r of rows) {
    const key: AccountId = r.destination?.kind === 'account' ? r.destination.accountId : r.accountId;
    const prev = byAccount.get(key) ?? { chargesTotalCents: 0, chargesPaidCents: 0, budgetsCents: 0 };
    const mineCents = r.scope === 'commun' ? r.myShareCents : r.amountCents;
    prev.chargesTotalCents += mineCents;
    if (r.paid) prev.chargesPaidCents += mineCents;
    byAccount.set(key, prev);
  }

  for (const b of budgets) {
    const key: AccountId = b.accountId;
    const prev = byAccount.get(key) ?? { chargesTotalCents: 0, chargesPaidCents: 0, budgetsCents: 0 };
    prev.budgetsCents += b.myShareCents;
    byAccount.set(key, prev);
  }

  const order = state.accounts.map((a) => a.id);
  return order
    .map((id) => {
      const a = state.accounts.find((x) => x.id === id);
      const t = byAccount.get(id) ?? { chargesTotalCents: 0, chargesPaidCents: 0, budgetsCents: 0 };
      return {
        accountId: id,
        accountName: a?.name ?? id,
        kind: a?.kind ?? 'perso',
        chargesTotalCents: t.chargesTotalCents,
        chargesPaidCents: t.chargesPaidCents,
        budgetsCents: t.budgetsCents,
        totalCents: t.chargesTotalCents + t.budgetsCents,
      };
    })
    .filter((x) => x.totalCents !== 0);
}
