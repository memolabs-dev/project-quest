# project-quest: levels, the tutorial, skills and ranks

Status: draft for the owner's review, 2026-11-17. Decisions taken one by one with the owner (Guillaume) in the brainstorm of 16 and 17 November 2026. Extends section 6 of `2026-11-16-project-quest-design.md`.

## 1. Purpose

"Comme dans tout jeu vidéo" (owner, 2026-11-16): the game starts with a tutorial, the player discovers each step as they go, through levels, ranks, skills and rewards.

**The first player is a beginner volunteer** (owner's choice): someone who has never used GitHub and wants to contribute to a project. The volunteer's path comes first; the lead's path follows later on the same engine.

Success means: a volunteer who has never touched GitHub reaches their first merged pull request through the game, understands what they did, and asks for a real issue on a real project on their own.

## 2. Principles

1. **A level passes only when GitHub says so.** The server re-reads GitHub and decides; the browser never does. A gesture made on GitHub directly, outside the game, counts too.
2. **Practice in your own repository first** (owner's choice). Real gestures happen in a practice repository the game creates in the volunteer's own GitHub account, at no risk to anyone.
3. **Inside the game first, then real git** (owner's choice). The first pull request is made without a terminal; real git on the volunteer's machine comes one rank later.
4. **Progression is personal.** Ranks, stamps and rewards belong to the player; nothing compares players. Spec principle 3 ("no pressure on contributors") stands.
5. **Every write is shown, then confirmed**, like every other gesture.

## 3. The path

Every level has the same shape: a goal, a short lesson from the mentor, the gesture, a check on GitHub, a stamp in the skill book.

| Rank | Level | Skill stamped | Where |
|---|---|---|---|
| Apprentice | 1 | Walk the site, open a pallet | fictitious site |
| Apprentice | 2 | Read an issue (title, text, labels) | fictitious site |
| Apprentice | 3 | Read a board (zones are columns; a pallet moving is work moving) | fictitious site |
| Apprentice | 4 | Found your site: create `my-first-site` and its board | your account |
| Apprentice | 5 | Write an issue | your practice repo |
| Apprentice | 6 | Take an issue: assign yourself and say so in a comment | your practice repo |
| Apprentice | 7 | Move your issue to "In progress" | your practice repo |
| Journeyman | 8 | Edit a file in the game (branch and commit through the API) | your practice repo |
| Journeyman | 9 | Open a pull request linked to the issue (`Closes #N`) | your practice repo |
| Journeyman | 10 | Answer a review: the inspector's remarks, a fix pushed | your practice repo |
| Journeyman | 11 | Merge: the issue closes, the floor grows | your practice repo |
| Team leader | 12 | Clone, branch, commit, push: a branch arrives with a commit made on your machine | your practice repo |
| Team leader | 13 | Bring main's latest into your branch (after the mayor changes the plan on main) | your practice repo |
| Team leader | 14 | Fix a pull request from your machine: a new commit pushed to it | your practice repo |
| Team leader | 15 | Clean up: the pull request merged, its branch deleted | your practice repo |
| Real project | 16 | Find a good first issue and ask for it in a comment | a real project, chosen by the player |

On the real project, nobody is ever assigned without asking: the volunteer asks, a maintainer assigns.

**Why the Team leader rank is cut this way (owner, 2026-11-17).** GitHub sees git work on a machine only at the push: cloning, branching and committing leave no trace before it. Each Team leader level therefore passes on something GitHub shows: a pushed branch whose head was committed on the machine (`committedViaWeb` false, on a branch other than the default and `practice-N`, beyond the default head; checked on 2026-11-17: API commits read `true`, but a REST contents commit reads `false`, so the branch rules matter), main's head inside the branch, a pushed commit on an open pull request, a merged pull request whose branch is gone. The game shows the commands to type; it never runs anything on the player's machine.

## 4. Rewards

**The skill book**: a "Skills" button beside the logbook. One page per rank, one stamp per skill with its date and its proof link on GitHub. Stamps not yet earned show as an outline, with one line on what they teach, so the next step is always in sight. Only its owner sees it.

**Each rank unlocks something visible on the site:**

| Rank | Unlocked |
|---|---|
| Apprentice (tutorial) | your helmet with your initial; the skill book |
| Apprentice (practice site) | your own site on the plot next door, your name on the gate |
| Journeyman | the trowel (file editing in the game); the first building on your site |
| Team leader | the van (git on your machine); the map of real projects |
| Real project | your badge among the real site's workers, only if you agree |

## 5. The mentor: Mémé Truelle

A journeywoman with forty years on sites. Kind and teasing, never condescending. Short sentences; the "why" in one line, never more. Never a deadline, never "hurry".

Sample lines (the final stock lives in `locales/en` and `locales/fr`):

| Moment | English | Français |
|---|---|---|
| First pallet opened | That's an issue. A job written down so nobody forgets it. Read the title first, always. | Ça, c'est une issue. Un boulot écrit noir sur blanc, pour que personne ne l'oublie. Lis toujours le titre d'abord. |
| Taking an issue | You said "I'll take it". Now everyone knows it's yours. Nobody else will do it twice. | Tu as dit « je prends ». Maintenant tout le monde sait que c'est à toi. Personne ne le fera en double. |
| First pull request | A pull request is you knocking on the door: "I've done this, can you look?" | Une pull request, c'est toi qui frappes à la porte : « J'ai fait ça, tu peux regarder ? » |
| Check not passed | Not yet. I don't see your comment on GitHub. Did it go? | Pas encore. Je ne vois pas ton commentaire sur GitHub. Il est parti ? |

## 6. How a level works

**Levels are data** (`src/shared/levels/`): each level declares its id, rank, skill, the locale keys of its lesson and goal, and a pure check function `check(observed) -> { done: boolean; proof: string | null }`. Adding a level means adding one file.

**The server observes, the check decides.** After the player's gesture (or when the player asks "check again"), the server reads what the level needs from GitHub (the practice repository, the player's issues, pull requests, comments, board items) into a small `observed` object and runs the check. On success it stores the stamp with its proof link.

**Tutorial levels (1 to 3)** play on the fictitious site; they pass on game events (a card opened, a pallet moved on the demo site). Nothing is sent to GitHub.

**The practice repository** is found by name in the player's account (`my-first-site`, configurable). If it exists, the game reuses it and never overwrites it. Created public by default (it starts a beginner's GitHub profile); the player can choose private at creation.

**Scopes.** The player's `gh` login needs `repo` and `project`. A missing scope is explained in plain words with the command to run, as the game already does.

**API.** Founding: `createRepository`, `createProjectV2`, `linkProjectV2ToRepository`, the status field. Issues and comments: `createIssue`, `addAssigneesToAssignable`, `addComment`. Editing in the game: `createRef` (branch) and `createCommitOnBranch`. Pull requests: `createPullRequest`, `mergePullRequest`. Each becomes a gesture with `prepare` and `apply`, and its decision in `src/github/api-coverage.ts` moves from "out" or "later" to "gesture".

## 7. Data

- `progress`: player, level id, stamped at, proof URL (or `tutorial`).
- `players` gains the practice repository's name.
- GitHub stays the truth: if the table is lost, re-checking every level on GitHub restores each stamp whose proof still exists.

## 8. Safety

- During the levels, the server writes **only to the practice repository** it created or found in the player's own account. Any other target is refused by the server, not just hidden in the interface.
- Every write is shown, then confirmed, and logged in `action_log`.
- The game never deletes anything. Once done, the player archives the practice repository on GitHub.
- **Test stages** (owner's rule): our tests use a practice repository with `FICTIF` content in a test account. Never a real organisation's project.

## 9. Testing

- Vitest: each level's check on recorded GitHub data, "done" and "not yet"; English and French parity of the mentor's lines; the server refuses a level gesture aimed outside the practice repository.
- Playwright: the Apprentice tutorial (levels 1 to 3) played from start to end on the demo site.
- By hand, once per slice: the practice site founded and the levels played for real on the test account.

## 10. Slices

- **4a**: the engine, the skill book, Mémé Truelle; the Apprentice rank in full (levels 1 to 7) and its rewards.
- **4b**: Journeyman (levels 8 to 11): editing in the game, pull request, review, merge, the floor growing on your own site.
- **4c**: Team leader (levels 12 to 15): real git, checked on GitHub.
- **4d**: Real project (level 16): asking for a good first issue.
- **Later**: the lead's path, on the same engine.

Each slice is an issue of this repository on board 9, created when the previous one ships.

## 11. Out of scope for now

- Rankings or comparisons between players, in any form.
- Assigning a volunteer on a real project from the game.
- Deleting or archiving the practice repository from the game.
