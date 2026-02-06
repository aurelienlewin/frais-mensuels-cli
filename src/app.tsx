import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { authLogin, authLogout, authMe, cloudGetState } from './api/client.js';
import { getBaseUrl, getUserEmail, setBaseUrl, setSessionCookie, setUserEmail } from './config.js';
import { monthLabelFr, ymAdd, ymFromDate, type YM } from './lib/date.js';
import { formatEUR } from './lib/money.js';
import { normalizeState } from './state/normalize.js';
import { totalsForMonth } from './state/selectors.js';
import type { AppState } from './state/types.js';

type Screen = 'boot' | 'baseUrl' | 'login' | 'loading' | 'summary' | 'error';

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
    }
  });

  const totals = useMemo(() => {
    if (!appState) return null;
    return totalsForMonth(appState, currentYm);
  }, [appState, currentYm]);

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
            <Text color="gray">left/right mois - r sync - l logout - q quitter</Text>
            <Text color="gray">App: fraismensuels-cli</Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
