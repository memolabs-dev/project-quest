# Try project-quest: the volunteer's path

*[Version française](ONBOARDING.fr.md)*

About an hour. You play the volunteer's path on **your own GitHub account**: the game creates a small practice repository, `my-first-site`, and everything you do stays in your account. Nothing touches a real Data for Good or SOS MEDITERRANEE project.

## 1. Install (5 minutes)

You need Node 22.12 or later, git, the GitHub command line (`gh`) and a recent browser (Chrome, Firefox, Safari).

```bash
git clone https://github.com/memolabs-dev/project-quest.git
cd project-quest
npm install
```

## 2. The demo site, no account (5 minutes)

```bash
npm run dev:demo
```

Open http://localhost:5173. Everything is invented and nothing goes to GitHub. Keys: WASD (or ZQSD, or the arrows) to walk, E to open a pallet, Escape to close it. Mémé Truelle greets you: choose "Lend a hand".

## 3. The real path, on your account (45 minutes)

Log `gh` in to your account with the `repo` and `project` scopes (the game uses your login on your machine; no token reaches the browser):

```bash
gh auth login
gh auth refresh -s project
npm run dev
```

Open http://localhost:5173/?demo=1 and follow Mémé: the first three levels play on the demo, then she offers to found your site (`my-first-site`, public by default, private if you prefer). The path has 16 levels: write an issue, take it, move it, edit a file, open a pull request, answer a review, merge, then git on your machine. Before every write the game shows exactly what goes to GitHub; nothing leaves without your click.

Level 16 has you ask for an issue on a real project: here it is the sandbox `memolabs-dev/project-quest-sandbox`, whose issues are marked FICTIF. Go ahead.

Optional: to keep your stamps when you restart the server, `npm run db:up && npm run db:migrate`, then `export DATABASE_URL=postgres://quest:quest@localhost:5442/quest` before `npm run dev` (needs Docker).

## 4. Suggest an improvement

What blocked you, what you liked, what is missing: open an issue on https://github.com/memolabs-dev/project-quest/issues, one per idea, with a screenshot if you can. Small remarks can go together in one "Trial feedback" issue.

## 5. At the end

Your `my-first-site` repository (and `my-first-team` if you tried the lead's path) is yours: keep it, archive it or delete it from GitHub.
