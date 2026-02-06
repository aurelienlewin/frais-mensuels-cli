import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { authLogout } from './api/client.js';
import { setSessionCookie, setUserEmail } from './config.js';

async function run() {
  const args = process.argv.slice(2);
  if (args[0] === 'logout') {
    try {
      await authLogout();
    } catch {
      // ignore network errors on logout
    }
    setSessionCookie(null);
    setUserEmail(null);
    process.stdout.write('Session cleared.\n');
    return;
  }

  render(<App />);
}

run().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
