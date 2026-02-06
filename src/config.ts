import Conf from 'conf';

export type CliConfig = {
  baseUrl?: string;
  sessionCookie?: string;
  userEmail?: string;
};

const config = new Conf<CliConfig>({
  projectName: 'fraismensuels-cli',
});

const DEFAULT_BASE_URL = 'https://frais-mensuels.vercel.app';

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/g, '');
  return `https://${trimmed.replace(/\/+$/g, '')}`;
}

export function getBaseUrl(): string | null {
  const env = process.env.FRAISMENSUELS_BASE_URL;
  if (env && env.trim()) return normalizeBaseUrl(env);
  const stored = config.get('baseUrl');
  if (stored) return normalizeBaseUrl(stored);
  return DEFAULT_BASE_URL;
}

export function setBaseUrl(url: string) {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) return;
  config.set('baseUrl', normalized);
}

export function getSessionCookie(): string | null {
  return config.get('sessionCookie') ?? null;
}

export function setSessionCookie(value: string | null) {
  if (value && value.trim()) {
    config.set('sessionCookie', value.trim());
  } else {
    config.delete('sessionCookie');
  }
}

export function getUserEmail(): string | null {
  return config.get('userEmail') ?? null;
}

export function setUserEmail(value: string | null) {
  if (value && value.trim()) {
    config.set('userEmail', value.trim());
  } else {
    config.delete('userEmail');
  }
}
