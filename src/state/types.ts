import type { YM } from '../lib/date';

export type AccountId = string;

export type Account = {
  id: AccountId;
  name: string;
  kind: 'perso' | 'commun';
  active: boolean;
};

export type UiState = {
  tourDismissed?: boolean;
};

export type ChargeScope = 'perso' | 'commun';
export type ChargePayment = 'auto' | 'manuel';

export type ChargeDestination =
  | { kind: 'account'; accountId: AccountId }
  | { kind: 'text'; text: string };

export type Charge = {
  id: string;
  name: string;
  amountCents: number;
  sortOrder: number;
  dayOfMonth: number;
  accountId: AccountId;
  scope: ChargeScope;
  splitPercent?: number; // commun only (default 50)
  payment: ChargePayment;
  destination?: ChargeDestination | null;
  active: boolean;
};

export type Budget = {
  id: string;
  name: string;
  amountCents: number;
  accountId: AccountId;
  scope: ChargeScope;
  splitPercent?: number; // commun only (default 50)
  inactiveFromYm?: YM;
  active: boolean;
};

export type MonthChargeSnapshot = Pick<
  Charge,
  'name' | 'amountCents' | 'sortOrder' | 'dayOfMonth' | 'accountId' | 'scope' | 'splitPercent' | 'payment' | 'destination'
>;

export type MonthChargeState = {
  paid: boolean;
  snapshot?: MonthChargeSnapshot;
  removed?: boolean;
};

export type MonthBudgetSnapshot = Pick<Budget, 'name' | 'amountCents' | 'accountId' | 'scope' | 'splitPercent'>;

export type BudgetExpense = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  amountCents: number; // positive number = spending
};

export type MonthBudgetState = {
  expenses: BudgetExpense[];
  snapshot?: MonthBudgetSnapshot;
};

export type MonthData = {
  ym: YM;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  salaryCents?: number;
  charges: Record<string, MonthChargeState>;
  budgets: Record<string, MonthBudgetState>;
};

export type AppState = {
  version: 1;
  modifiedAt?: string; // ISO string - updated on any change (used for sync/conflicts)
  salaryCents: number;
  accounts: Account[];
  charges: Charge[];
  budgets: Budget[];
  months: Record<YM, MonthData>;
  ui?: UiState;
};
