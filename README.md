# fraismensuels-cli

Client TUI néon pour le webapp Frais mensuels. Rapide, clavier-first, et synchronisé avec les mêmes données cloud.

## Résumé rapide

- Se connecte au même backend que le webapp (`/api/auth/*`, `/api/state`).
- Vue synthèse + charges + enveloppes (budgets) + dépenses.
- Marquer une charge OK, ajouter une dépense, sync cloud.
- Interface compacte avec micro-animations et navigation clavier.

## Démarrer

1) Installer
- `npm install`

2) Lancer (dev)
- `npm run dev`

3) Build
- `npm run build`

4) Exécuter (après build)
- `node dist/index.js`

## Configuration

- Base URL par défaut: `https://frais-mensuels.vercel.app`
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
<summary>Flux de données</summary>

- Les données sont récupérées depuis `/api/state`.
- Les modifications sont poussées avec le même schéma que le webapp.
- La session est stockée localement (cookie) dans le config système.

</details>

<details>
<summary>Conseils TUI</summary>

- Utiliser un vrai terminal (TTY) pour les touches.
- Si l'écran est petit, la liste des charges est paginée.

</details>
