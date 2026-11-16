# project-quest

*[English version](README.md)*

**Transforme ton projet GitHub en jeu vidéo.** Tu te promènes sur un chantier en 3D : chaque épopée est un bâtiment qui gagne un étage par tâche finie, chaque issue est une palette de la couleur de sa colonne. Pousse une palette vers une autre zone et la carte bouge sur ton vrai tableau GitHub Projects, après que tu as vu et confirmé exactement ce qui part.

![La fiche d'une palette sur le chantier de démo](e2e/screenshots/card-1280.png)

État : première tranche jouable. On se promène sur le chantier, on ouvre une palette, on la déplace pour de vrai, on garde un carnet de chantier. En anglais et en français.

## Essayer en 30 secondes (sans compte)

```bash
npm install
npm run dev:demo
```

Ouvre http://localhost:5173. Le chantier de démo est un projet inventé : rien n'est envoyé à GitHub.

## Jouer sur ton propre tableau

1. Connecte-toi à GitHub avec la ligne de commande et donne-lui le droit `project` : `gh auth login`, puis `gh auth refresh -s project` (le jeu utilise ta connexion sur ta machine ; aucun jeton n'arrive dans le navigateur).
2. Indique ton tableau dans `quest.config.json` : propriétaire, dépôt, numéro du projet, noms des champs de statut, de sprint et de taille, et ses colonnes dans l'ordre.
3. Facultatif, pour garder le carnet : `npm run db:up && npm run db:migrate`, puis `export DATABASE_URL=postgres://quest:quest@localhost:5442/quest`.
4. `npm run dev`.

Chaque déplacement montre d'abord la requête GitHub exacte, vérifie que personne n'a bougé la palette entre-temps, puis s'inscrit au carnet.

## Comment c'est fait

- **Le jeu** : React 19, Three.js r187 via React Three Fiber 9, la physique Rapier, ecctrl pour le chef de chantier, zustand.
- **Le serveur** : Hono, seul à parler à GitHub (GraphQL), servi dans Vite pendant le développement.
- **Le carnet** : Postgres 18 avec Drizzle.
- **Les modèles 3D** : générés par des scripts Blender (`npm run assets`), compressés avec glTF Transform. Aucun modèle tiers.
- **L'API GitHub** : les 1873 opérations sont listées et décidées (`docs/github-api/COVERAGE.md`) ; un test échoue s'il en manque une.

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run dev:demo` | le chantier de démo |
| `npm run dev` | ton tableau (revient à la démo sans accès GitHub) |
| `npm test` | tests unitaires (Vitest) |
| `npm run test:e2e` | tests de bout en bout dans Chrome (Playwright), en démo |
| `npm run test:db` | le carnet contre Postgres |
| `npm run check` | types, lint et tests (aussi lancés avant chaque push) |
| `npm run assets` | reconstruit le kit 3D avec Blender |

Clavier : les touches de déplacement sont physiques (WASD en QWERTY, ZQSD en AZERTY), les flèches marchent toujours, `E` ou un clic ouvre une palette, `Échap` la referme.

Conception et plan : `docs/superpowers/specs/` et `docs/superpowers/plans/`.
