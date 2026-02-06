# fraismensuels-cli

Neon CLI client for the Frais Mensuels webapp.

## Setup

1) Install deps
- `npm install`

2) Configure base URL (optional)
- Default: `https://frais-mensuels.vercel.app`
- Override: `FRAISMENSUELS_BASE_URL=https://your-app-domain`

3) Run
- `npm run dev`

## Commands

- `fraismensuels` — launch interactive TUI
- `fraismensuels logout` — clear session

## Hotkeys

- `c` charges list
- `e` add envelope expense
- `space` mark charge OK (in charges view)
- `r` sync
- `l` logout
- `q` quit
