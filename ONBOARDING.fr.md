# Essayer project-quest : le parcours du bénévole

*[English version](ONBOARDING.md)*

Une heure environ. Tu joues le parcours du bénévole sur **ton propre compte GitHub** : le jeu crée un petit dépôt d'entraînement, `my-first-site`, et tout ce que tu fais reste chez toi. Rien ne touche un vrai projet de Data for Good ou de SOS MEDITERRANEE.

## 1. Installer (5 minutes)

Il faut Node 22.12 ou plus, git, la ligne de commande GitHub (`gh`) et un navigateur récent (Chrome, Firefox, Safari).

```bash
git clone https://github.com/memolabs-dev/project-quest.git
cd project-quest
npm install
```

## 2. Le chantier de démo, sans compte (5 minutes)

```bash
npm run dev:demo
```

Ouvre http://localhost:5173. Tout est inventé, rien ne part vers GitHub. Les touches : ZQSD (ou WASD, ou les flèches) pour marcher, E pour ouvrir une palette, Échap pour fermer. Mémé Truelle t'accueille : choisis « Donner un coup de main ».

## 3. Le vrai parcours, sur ton compte (45 minutes)

Connecte `gh` à ton compte, avec les droits `repo` et `project` (le jeu utilise ta connexion sur ta machine, aucun jeton n'arrive dans le navigateur) :

```bash
gh auth login
gh auth refresh -s project
npm run dev
```

Ouvre http://localhost:5173/?demo=1 et suis Mémé : les trois premiers niveaux se jouent sur la démo, puis elle te propose de fonder ton chantier (`my-first-site`, public par défaut, privé si tu préfères). Le parcours compte 16 niveaux : écrire une issue, la prendre, la déplacer, modifier un fichier, ouvrir une pull request, répondre à une revue, fusionner, puis git sur ta machine. Avant chaque écriture, le jeu montre exactement ce qui part vers GitHub ; rien ne part sans ton clic.

Le niveau 16 te fait demander une issue sur un vrai projet : ici, c'est le bac à sable `memolabs-dev/project-quest-sandbox`, dont les issues sont marquées FICTIF. Tu peux y aller franchement.

Facultatif : pour garder tes tampons quand tu relances le serveur, `npm run db:up && npm run db:migrate`, puis `export DATABASE_URL=postgres://quest:quest@localhost:5442/quest` avant `npm run dev` (Docker nécessaire).

## 4. Proposer une amélioration

Ce qui t'a bloqué, ce qui t'a plu, ce qui manque : ouvre une issue sur https://github.com/memolabs-dev/project-quest/issues, une par idée, avec une capture si possible. Les petites remarques peuvent aller dans une seule issue « Retours de l'essai ».

## 5. À la fin

Ton dépôt `my-first-site` (et `my-first-team` si tu as essayé le parcours du lead) est à toi : garde-le, archive-le ou supprime-le depuis GitHub.
