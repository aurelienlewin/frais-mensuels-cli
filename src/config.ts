import Conf from 'conf';

export type CliConfig = {
  baseUrl?: string;
  sessionCookie?: string;
  userEmail?: string;
};

const config = new Conf<CliConfig>({
  projectName: 'fraismensuels-cli',
});

export function getBaseUrl(): string | null {
  const env = process.env.FRAISMENSUELS_BASE_URL;
  if (env && env.trim()) return env.trim().replace(/\/+$/g, '');
  const stored = config.get('baseUrl');
  return stored ? stored.replace(/\/+$/g, '') : null;
}

export function setBaseUrl(url: string) {
  config.set('baseUrl', url.replace(/\/+$/g, ''));
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
