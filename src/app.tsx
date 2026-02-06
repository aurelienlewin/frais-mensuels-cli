import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { authLogin, authLogout, authMe, cloudGetState, cloudPutState } from './api/client.js';
import { getBaseUrl, getUserEmail, setBaseUrl, setSessionCookie, setUserEmail } from './config.js';
import { monthLabelFr, ymAdd, ymFromDate, type YM } from './lib/date.js';
import { eurosToCents, formatEUR, parseEuroAmount } from './lib/money.js';
import { normalizeState } from './state/normalize.js';
import { budgetsForMonth, chargesForMonth, totalsForMonth } from './state/selectors.js';
import type { AppState, BudgetExpense, MonthData } from './state/types.js';

type Screen = 'boot' | 'baseUrl' | 'login' | 'loading' | 'summary' | 'charges' | 'addExpense' | 'error';

type LoadState = {
  status: 'idle' | 'loading' | 'error';
  message?: string;
  error?: string;
};

function usePulse(periodMs = 700) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), periodMs);
    return () => clearInterval(id);
  }, [periodMs]);
  return on;
}

function NeonFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const pulse = usePulse(900);
  const borderColor = pulse ? 'magentaBright' : 'cyanBright';
  return (
    <Box borderStyle="round" borderColor={borderColor} paddingX={2} paddingY={1} flexDirection="column" gap={1}>
      <Text color={pulse ? 'magentaBright' : 'cyanBright'}>{title}</Text>
      {children}
    </Box>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box borderStyle="round" borderColor="blueBright" paddingX={2} paddingY={1} flexDirection="column" width={30}>
      <Text color="gray">{label}</Text>
      <Text color="cyanBright" bold>
        {value}
      </Text>
      {hint ? <Text color="gray">{hint}</Text> : null}
    </Box>
  );
}

function neonify(text: string) {
  const palette = ['#00e5ff', '#ff4dff', '#7c4dff', '#00ff9d'];
  return text
    .split('')
    .map((char, idx) => chalk.hex(palette[idx % palette.length] ?? '#00e5ff')(char))
    .join('');
}

function nowIso() {
  return new Date().toISOString();
}

function todayIsoLocal() {
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ensureMonth(state: AppState, ym: MonthData['ym']): MonthData {
  const existing = state.months[ym];
  if (existing) return existing;
  const now = nowIso();
  return {
    ym,
    archived: false,
    createdAt: now,
    updatedAt: now,
    charges: {},
    budgets: {},
  };
}

function uid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('boot');
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [baseUrl, setBaseUrlState] = useState<string | null>(() => getBaseUrl());
  const [baseUrlDraft, setBaseUrlDraft] = useState<string>('');
  const [email, setEmail] = useState<string>(() => getUserEmail() ?? '');
  const [password, setPassword] = useState<string>('');
  const [loginStep, setLoginStep] = useState<'email' | 'password'>('email');
  const [appState, setAppState] = useState<AppState | null>(null);
  const [currentYm, setCurrentYm] = useState<YM>(() => ymFromDate(new Date()));
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [expenseStep, setExpenseStep] = useState<'selectBudget' | 'label' | 'amount' | 'date'>('selectBudget');
  const [expenseBudgetIdx, setExpenseBudgetIdx] = useState(0);
  const [expenseLabel, setExpenseLabel] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseError, setExpenseError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseUrl) {
      setScreen('baseUrl');
      setBaseUrlDraft('');
      return;
    }

    let cancelled = false;
    const run = async () => {
      setScreen('loading');
      setLoadState({ status: 'loading', message: 'Verification de session...' });
      try {
        const user = await authMe();
        if (cancelled) return;
        if (!user) {
          setScreen('login');
          return;
        }
        setUserEmail(user.email);
        await refreshState('Sync cloud...');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setLoadState({ status: 'error', error: msg });
        setScreen('error');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  useEffect(() => {
    if (!process.stdout.isTTY) return;
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  }, [screen, expenseStep, loginStep]);

  const refreshState = async (message = 'Chargement...') => {
    setScreen('loading');
    setLoadState({ status: 'loading', message });
    try {
      const record = await cloudGetState();
      if (record?.state && typeof record.state === 'object') {
        const normalized = normalizeState(record.state as AppState);
        setAppState(normalized);
      } else {
        setAppState(null);
      }
      setLastSyncAt(new Date().toISOString());
      setScreen('summary');
      setLoadState({ status: 'idle' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadState({ status: 'error', error: msg });
      setScreen('error');
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
    if (screen === 'summary') {
      if (input === 'q') exit();
      if (input === 'r') void refreshState('Sync cloud...');
      if (input === 'c') setScreen('charges');
      if (input === 'e') {
        setExpenseStep('selectBudget');
        setExpenseBudgetIdx(0);
        setExpenseLabel('');
        setExpenseAmount('');
        setExpenseDate('');
        setExpenseError(null);
        setScreen('addExpense');
      }
      if (input === 'l') {
        void authLogout().catch(() => undefined).finally(() => {
          setSessionCookie(null);
          setUserEmail(null);
          setPassword('');
          setLoginStep('email');
          setScreen('login');
        });
      }
      if (key.leftArrow) setCurrentYm((ym) => ymAdd(ym, -1));
      if (key.rightArrow) setCurrentYm((ym) => ymAdd(ym, 1));
      return;
    }

    if (screen === 'charges') {
      if (input === 'q') exit();
      if (input === 'b') setScreen('summary');
      if (input === 'e') {
        setExpenseStep('selectBudget');
        setExpenseBudgetIdx(0);
        setExpenseLabel('');
        setExpenseAmount('');
        setExpenseDate('');
        setExpenseError(null);
        setScreen('addExpense');
      }
      if (key.leftArrow) setCurrentYm((ym) => ymAdd(ym, -1));
      if (key.rightArrow) setCurrentYm((ym) => ymAdd(ym, 1));
      return;
    }

    if (screen === 'addExpense' && expenseStep === 'selectBudget') {
      if (input === 'q') {
        setScreen('summary');
        return;
      }
      if (key.upArrow) {
        setExpenseBudgetIdx((idx) => Math.max(0, idx - 1));
        return;
      }
      if (key.downArrow) {
        setExpenseBudgetIdx((idx) => {
          if (budgets.length === 0) return 0;
          return Math.min(budgets.length - 1, idx + 1);
        });
        return;
      }
      if (key.return) {
        if (budgets.length === 0) return;
        setExpenseStep('label');
        setExpenseError(null);
        return;
      }
    }
  });

  const totals = useMemo(() => {
    if (!appState) return null;
    return totalsForMonth(appState, currentYm);
  }, [appState, currentYm]);

  const budgets = useMemo(() => {
    if (!appState) return [];
    return budgetsForMonth(appState, currentYm);
  }, [appState, currentYm]);

  const charges = useMemo(() => {
    if (!appState) return [];
    return chargesForMonth(appState, currentYm);
  }, [appState, currentYm]);

  useEffect(() => {
    setExpenseBudgetIdx((idx) => {
      if (budgets.length === 0) return 0;
      return Math.max(0, Math.min(idx, budgets.length - 1));
    });
  }, [budgets.length]);

  const applyExpense = async () => {
    if (!appState) {
      setExpenseError('Aucun etat charge');
      return;
    }
    const month = ensureMonth(appState, currentYm);
    if (month.archived) {
      setExpenseError('Mois archive: ajout bloque');
      return;
    }
    const budget = budgets[expenseBudgetIdx];
    if (!budget) {
      setExpenseError('Enveloppe introuvable');
      return;
    }

    const amountParsed = parseEuroAmount(expenseAmount);
    if (amountParsed == null) {
      setExpenseError('Montant invalide');
      return;
    }
    const amountCents = Math.max(0, Math.round(eurosToCents(amountParsed)));
    if (amountCents <= 0) {
      setExpenseError('Montant invalide');
      return;
    }

    const label = expenseLabel.trim();
    if (!label) {
      setExpenseError('Libelle obligatoire');
      return;
    }

    const date = expenseDate.trim() || todayIsoLocal();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setExpenseError('Date invalide (YYYY-MM-DD)');
      return;
    }

    const expense: BudgetExpense = {
      id: uid('exp'),
      label,
      date,
      amountCents,
    };

    const existing = month.budgets[budget.id];
    const nextBudgets = {
      ...month.budgets,
      [budget.id]: {
        expenses: [expense, ...(existing?.expenses ?? [])],
        snapshot: existing?.snapshot,
      },
    };
    const updatedAt = nowIso();
    const nextMonth: MonthData = { ...month, budgets: nextBudgets, updatedAt };
    const nextState: AppState = {
      ...appState,
      months: { ...appState.months, [currentYm]: nextMonth },
      modifiedAt: updatedAt,
    };

    setScreen('loading');
    setLoadState({ status: 'loading', message: 'Envoi cloud...' });
    try {
      await cloudPutState(nextState, nextState.modifiedAt);
      setAppState(normalizeState(nextState));
      setLastSyncAt(new Date().toISOString());
      setExpenseError(null);
      setScreen('summary');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadState({ status: 'error', error: msg });
      setScreen('error');
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      <Text>{neonify('FRAIS MENSUELS')}</Text>
      <Text color="gray">neon CLI</Text>

      {screen === 'baseUrl' ? (
        <NeonFrame title="Connexion cloud">
          <Text color="gray">Saisis l'URL de ton app (ex: https://ton-app.vercel.app)</Text>
          <TextInput
            value={baseUrlDraft}
            onChange={setBaseUrlDraft}
            onSubmit={(value) => {
              const trimmed = value.trim();
              if (!trimmed) return;
              setBaseUrl(trimmed);
              setBaseUrlState(trimmed);
              setScreen('boot');
            }}
            placeholder="https://..."
          />
        </NeonFrame>
      ) : null}

      {screen === 'login' ? (
        <NeonFrame title="Login">
          <Box flexDirection="column" gap={1}>
            <Text color="gray">Email</Text>
            {loginStep === 'email' ? (
              <TextInput
                value={email}
                onChange={setEmail}
                onSubmit={(value) => {
                  if (!value.trim()) return;
                  setEmail(value.trim());
                  setLoginStep('password');
                }}
                placeholder="toi@exemple.fr"
              />
            ) : (
              <Text color="cyanBright">{email}</Text>
            )}
            <Text color="gray">Mot de passe</Text>
            {loginStep === 'password' ? (
              <TextInput
                value={password}
                onChange={setPassword}
                onSubmit={async (value) => {
                  if (!email.trim() || !value.trim()) return;
                  setLoadState({ status: 'loading', message: 'Connexion...' });
                  setScreen('loading');
                  try {
                    await authLogin(email.trim(), value);
                    setPassword('');
                    setLoginStep('email');
                    await refreshState('Sync cloud...');
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setLoadState({ status: 'error', error: msg });
                    setScreen('error');
                  }
                }}
                placeholder="********"
                mask="*"
              />
            ) : (
              <Text color="gray">**********</Text>
            )}
            <Text color="gray">Astuce: Enter apres l'email pour passer au mot de passe.</Text>
          </Box>
        </NeonFrame>
      ) : null}

      {screen === 'loading' ? (
        <NeonFrame title="Sync">
          <Text color="cyanBright">
            <Spinner type="dots" /> {loadState.message ?? 'Chargement...'}
          </Text>
        </NeonFrame>
      ) : null}

      {screen === 'error' ? (
        <NeonFrame title="Erreur">
          <Text color="redBright">{loadState.error ?? 'Erreur inconnue'}</Text>
          <Text color="gray">Appuie sur r pour reessayer ou q pour quitter.</Text>
        </NeonFrame>
      ) : null}

      {screen === 'summary' ? (
        <Box flexDirection="column" gap={1}>
          <NeonFrame title={`Mois - ${monthLabelFr(currentYm)}`}>
            <Box gap={2} flexWrap="wrap">
              <StatCard label="Salaire" value={totals ? formatEUR(totals.salaryCents) : '-'} />
              <StatCard label="Commun" value={totals ? formatEUR(totals.totalCommunCents) : '-'} />
              <StatCard label="Ma part" value={totals ? formatEUR(totals.totalPourMoiCents) : '-'} />
              <StatCard
                label="Reste a vivre"
                value={totals ? formatEUR(totals.resteAVivreCents) : '-'}
                hint={totals ? `${totals.pendingCount} en attente` : undefined}
              />
              <StatCard
                label="Enveloppes"
                value={totals ? formatEUR(totals.totalBudgetsCents) : '-'}
                hint={totals ? `${formatEUR(totals.totalBudgetSpentCents)} depenses` : undefined}
              />
              <StatCard
                label="Reste apres enveloppes"
                value={totals ? formatEUR(totals.resteAVivreApresEnveloppesCents) : '-'}
              />
            </Box>
          </NeonFrame>

          <Box justifyContent="space-between" paddingX={1}>
            <Text color="gray">Cloud: {baseUrl ?? '-'}</Text>
            <Text color="gray">Dernier sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('fr-FR') : '-'}</Text>
          </Box>

          <Box justifyContent="space-between" paddingX={1}>
            <Text color="gray">left/right mois - c charges - e depense - r sync - l logout - q quitter</Text>
            <Text color="gray">App: fraismensuels-cli</Text>
          </Box>
        </Box>
      ) : null}

      {screen === 'charges' ? (
        <Box flexDirection="column" gap={1}>
          <NeonFrame title={`Charges - ${monthLabelFr(currentYm)}`}>
            {charges.length === 0 ? (
              <Text color="gray">Aucune charge pour ce mois.</Text>
            ) : (
              <Box flexDirection="column" gap={0}>
                {charges.map((c) => (
                  <Box key={c.id} justifyContent="space-between">
                    <Text color={c.paid ? 'greenBright' : 'yellowBright'}>
                      {c.paid ? 'OK' : '..'} {c.name}
                    </Text>
                    <Text color="cyanBright">
                      {formatEUR(c.amountCents)} ({formatEUR(c.myShareCents)})
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </NeonFrame>
          <Box justifyContent="space-between" paddingX={1}>
            <Text color="gray">left/right mois - e depense - b retour - q quitter</Text>
            <Text color="gray">App: fraismensuels-cli</Text>
          </Box>
        </Box>
      ) : null}

      {screen === 'addExpense' ? (
        <NeonFrame title="Nouvelle depense enveloppe">
          {expenseStep === 'selectBudget' ? (
            <Box flexDirection="column" gap={1}>
              {budgets.length === 0 ? (
                <Text color="gray">Aucune enveloppe active. Appuie sur q pour revenir.</Text>
              ) : (
                <Box flexDirection="column" gap={0}>
                  {budgets.map((b, idx) => (
                    <Text key={b.id} color={idx === expenseBudgetIdx ? 'magentaBright' : 'white'}>
                      {idx === expenseBudgetIdx ? '›' : ' '} {b.name} - {formatEUR(b.amountCents)}
                    </Text>
                  ))}
                </Box>
              )}
              <Text color="gray">Fleches pour choisir, Enter pour valider, q pour annuler.</Text>
            </Box>
          ) : null}

          {expenseStep === 'label' ? (
            <Box flexDirection="column" gap={1}>
              <Text color="gray">Libelle de la depense</Text>
              <TextInput
                value={expenseLabel}
                onChange={setExpenseLabel}
                onSubmit={() => {
                  if (!expenseLabel.trim()) {
                    setExpenseError('Libelle obligatoire');
                    return;
                  }
                  setExpenseError(null);
                  setExpenseStep('amount');
                }}
                placeholder="Essence, courses..."
              />
            </Box>
          ) : null}

          {expenseStep === 'amount' ? (
            <Box flexDirection="column" gap={1}>
              <Text color="gray">Montant (EUR)</Text>
              <TextInput
                value={expenseAmount}
                onChange={setExpenseAmount}
                onSubmit={() => {
                  const parsed = parseEuroAmount(expenseAmount);
                  if (parsed == null || eurosToCents(parsed) <= 0) {
                    setExpenseError('Montant invalide');
                    return;
                  }
                  setExpenseError(null);
                  setExpenseStep('date');
                }}
                placeholder="12.50"
              />
            </Box>
          ) : null}

          {expenseStep === 'date' ? (
            <Box flexDirection="column" gap={1}>
              <Text color="gray">Date (YYYY-MM-DD)</Text>
              <TextInput
                value={expenseDate}
                onChange={setExpenseDate}
                onSubmit={() => void applyExpense()}
                placeholder={todayIsoLocal()}
              />
            </Box>
          ) : null}

          {expenseError ? <Text color="redBright">{expenseError}</Text> : null}
        </NeonFrame>
      ) : null}
    </Box>
  );
}
