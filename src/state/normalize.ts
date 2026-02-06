import type { Account, AppState, Budget, Charge, ChargeScope } from './types';

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'PERSONAL_MAIN', name: 'PERSONAL_MAIN', kind: 'perso', active: true },
  { id: 'PERSONAL_SAVINGS', name: 'PERSONAL_SAVINGS', kind: 'perso', active: true },
  { id: 'JOINT_MAIN', name: 'JOINT_MAIN', kind: 'commun', active: true },
];

export function normalizeState(state: AppState): AppState {
  let changed = false;

  const nextModifiedAt = (() => {
    const current = typeof state.modifiedAt === 'string' ? state.modifiedAt : null;
    if (current) return current;
    changed = true;
    const candidates: string[] = [];
    for (const m of Object.values(state.months)) {
      if (typeof (m as { updatedAt?: unknown }).updatedAt === 'string') candidates.push(m.updatedAt);
      if (typeof (m as { createdAt?: unknown }).createdAt === 'string') candidates.push(m.createdAt);
    }
    candidates.sort();
    return candidates[candidates.length - 1] ?? new Date().toISOString();
  })();

  const nextSalaryCents = Number.isFinite(state.salaryCents) ? state.salaryCents : 0;
  if (nextSalaryCents !== state.salaryCents) changed = true;

  // Accounts
  const inputAccounts: Account[] = Array.isArray(state.accounts) ? (state.accounts as Account[]) : [];
  const fallbackAccounts = inputAccounts.length ? inputAccounts : DEFAULT_ACCOUNTS;
  if (!inputAccounts.length) changed = true;

  let accounts = fallbackAccounts.map((a) => {
    const rawActive = (a as { active?: unknown }).active;
    const active = typeof rawActive === 'boolean' ? rawActive : true;
    const rawName = (a as { name?: unknown }).name;
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : a.id;
    const kind: Account['kind'] = a.kind === 'commun' ? 'commun' : 'perso';
    const changedThis =
      name !== rawName || active !== rawActive || kind !== (a as { kind?: unknown }).kind;
    if (changedThis) changed = true;
    return { ...a, name, active, kind };
  });
  if (accounts.length && accounts.every((a) => !a.active)) {
    changed = true;
    accounts = accounts.map((a, i) => (i === 0 ? { ...a, active: true } : a));
  }

  // UI prefs (default to dismissed for existing datasets; seed sets false for new users)
  const ui = (() => {
    const raw = (state as { ui?: unknown }).ui;
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    const tourDismissed = typeof obj?.tourDismissed === 'boolean' ? obj.tourDismissed : true;
    const hadUi = Boolean(obj);
    const changedThis = !hadUi || tourDismissed !== obj?.tourDismissed;
    if (changedThis) changed = true;
    return { tourDismissed };
  })();

  // Charges: ensure sortOrder exists (older saves won't have it)
  const chargesNeedSortOrder = state.charges.some((c) => typeof (c as Charge).sortOrder !== 'number');
  let charges = chargesNeedSortOrder
    ? (() => {
        changed = true;
        const next = state.charges.map((c) => ({ ...c })) as Charge[];
        const scopes: ChargeScope[] = ['commun', 'perso'];
        const orderById = new Map<string, number>();
        for (const scope of scopes) {
          const group = next
            .filter((c) => c.scope === scope)
            .sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name));
          group.forEach((c, idx) => orderById.set(c.id, (idx + 1) * 10));
        }
        return next.map((c) => ({ ...c, sortOrder: orderById.get(c.id) ?? 9999 }));
      })()
    : state.charges;

  // Budgets: ensure scope exists (older saves won't have it)
  const budgetsNeedScope = state.budgets.some((b) => typeof (b as Budget).scope !== 'string');
  const budgets = budgetsNeedScope
    ? (() => {
        changed = true;
        return state.budgets.map((b) => {
          const scope: Budget['scope'] = (b as Budget).scope === 'commun' ? 'commun' : 'perso';
          const splitPercent =
            scope === 'commun'
              ? typeof (b as Budget).splitPercent === 'number' && Number.isFinite((b as Budget).splitPercent)
                ? Math.max(0, Math.min(100, Math.round((b as Budget).splitPercent as number)))
                : 50
              : undefined;
          return { ...b, scope, splitPercent };
        });
      })()
    : state.budgets;

  // Archived month snapshots: ensure snapshot.sortOrder exists for stable display.
  const chargeById = new Map<string, Charge>(charges.map((c) => [c.id, c]));
  const months = (() => {
    let monthsChanged = false;
    const nextMonths = { ...state.months };
    for (const [ym, month] of Object.entries(state.months)) {
      const entries = Object.entries(month.charges).filter(([, st]) => Boolean(st.snapshot)) as Array<
        [string, { paid: boolean; snapshot: NonNullable<(typeof month.charges)[string]['snapshot']> }]
      >;
      const missingSnapshotOrder = entries.some(([, st]) => typeof (st.snapshot as { sortOrder?: unknown }).sortOrder !== 'number');
      if (!missingSnapshotOrder) continue;

      monthsChanged = true;
      const sorted = [...entries].sort((a, b) => {
        const sa = a[1].snapshot;
        const sb = b[1].snapshot;
        return sa.dayOfMonth - sb.dayOfMonth || sa.name.localeCompare(sb.name);
      });
      const fallback = new Map<string, number>();
      sorted.forEach(([id], idx) => fallback.set(id, (idx + 1) * 10));

      const nextCharges = { ...month.charges };
      for (const [id, st] of entries) {
        const current = st.snapshot as { sortOrder?: unknown };
        if (typeof current.sortOrder === 'number') continue;
        const fromCharge = chargeById.get(id)?.sortOrder;
        const nextSnap = { ...st.snapshot, sortOrder: typeof fromCharge === 'number' ? fromCharge : (fallback.get(id) ?? 9999) };
        nextCharges[id] = { ...st, snapshot: nextSnap };
      }
      nextMonths[ym as keyof typeof nextMonths] = { ...month, charges: nextCharges };
    }
    if (!monthsChanged) return state.months;
    changed = true;
    return nextMonths;
  })();

  if (!changed) return state;
  return {
    ...state,
    modifiedAt: nextModifiedAt,
    salaryCents: nextSalaryCents,
    accounts,
    charges,
    budgets,
    months,
    ui,
  };
}
