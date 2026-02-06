# fraismensuels-cli

Neon TUI client for the Frais mensuels webapp. Fast, keyboard-first, and synced with the same cloud data.

## Resume rapide

- Se connecte au meme backend que le webapp (`/api/auth/*`, `/api/state`).
- Vue synthese + charges + enveloppes (budgets) + depenses.
- Marquer une charge OK, ajouter une depense, sync cloud.
- Interface compacte avec micro-animations et navigation clavier.

## Demarrer

1) Installer
- `npm install`

2) Lancer
- `npm run dev`

3) Build
- `npm run build`

## Configuration

- Base URL par defaut: `https://frais-mensuels.vercel.app`
- Override: `FRAISMENSUELS_BASE_URL=https://your-app-domain`

## Commandes

- `fraismensuels` : lancer la TUI
- `fraismensuels logout` : vider la session locale

## Hotkeys

- `c` : charges
- `e` : ajouter une depense (enveloppe)
- `space` : marquer OK (vue charges)
- `f` ou `/` : filtre par nom (vue charges)
- `n` / `p` : page suivante / precedente (vue charges)
- `r` : sync
- `l` : logout
- `q` : quitter

<details>
<summary>Flux de donnees</summary>

- Les donnees sont recuperees depuis `/api/state`.
- Les modifications sont poussees avec le meme schema que le webapp.
- La session est stockee localement (cookie) dans le config systeme.

</details>

<details>
<summary>Conseils TUI</summary>

- Utiliser un vrai terminal (TTY) pour les touches.
- Si l'ecran est petit, la liste des charges est paginee.

</details>
