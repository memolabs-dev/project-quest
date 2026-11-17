# project-quest: the lead's path

Status: draft for the owner's review, 2026-11-17. Decisions taken with the owner (Guillaume) in the brainstorm of 17 November 2026. Second path of `2026-11-17-levels-design.md` (section 6 of the main spec: "the lead's path: from 'what is an issue' to running a board, a sprint, a milestone and a review round"). Same engine, same skill book, same principles.

## 1. Purpose

A player who has never run a project learns to run one: take an incoming flow in hand, plan, then steer. Success means a beginner lead can, on their own board, sort what comes in, get it ready, plan a sprint against a milestone, keep work in progress under control and tell the team where things stand.

## 2. Principles (on top of the levels' principles)

1. **The lead practises on their own team site** (owner's choice): a second practice repository, `my-first-team`, in the player's own account, separate from the volunteer's `my-first-site`.
2. **The game plays a fictitious team, honestly.** GitHub knows only real people and the game writes with the player's token, so everything "the team" does is written by the player, marked `FICTIF` in its title and "written by project-quest for practice" in its body. It never passes for a real person.
3. **Every write is shown, then confirmed**, and logged; the server writes only to `my-first-team`.
4. **The game never assigns anyone**: there are no fictitious accounts, and principle 3 of the main spec stands.
5. **A level passes only on what GitHub shows**, except one game rule named as such: a sprint's capacity (section 5).

## 3. The path

| Rank | Level | Skill | GitHub shows |
|---|---|---|---|
| Site foreman | L1 | Found the team site: repository, board with five zones, a Size field | the repository, its linked board, its Status options, the Size field |
| Site foreman | L2 | Sort the mayor's parcels: label each, close the duplicate with its reason | every mayor's issue labelled; the duplicate closed as `DUPLICATE` |
| Site foreman | L3 | The inspector's Definition of Ready: a checklist, then "Ready" | an issue with a task list in its body, in the "Ready" column |
| Site foreman | L4 | Size the work | every "Ready" issue has a Size |
| Site manager | L5 | Plan a sprint | an Iteration field; the current iteration holds issues whose sizes stay within the declared capacity |
| Site manager | L6 | Set the mayor's visit | a milestone with a due date and issues attached |
| Site manager | L7 | Split a task too big | an issue with sub-issues |
| Site manager | L8 | Rope two pallets | an issue blocked by another |
| Project director | L9 | The evening bulletin | a status update posted on the board |
| Project director | L10 | Keep work in progress under the limit | "Being laid" back under its limit after the team's day pushed it over |
| Project director | L11 | The mayor's visit | the milestone closed with all its issues done, or its due date moved |

The review round is not in the lead's path: GitHub does not let anyone review their own pull request. It stays on GitHub, and in the volunteer's path through the inspector.

## 4. The fictitious team

The game writes three kinds of things, each a confirmed gesture:

- **The mayor's parcels** (L2): six `FICTIF` issues at once: a duplicate of another, a bug, a task far too big, two vague ones, a clear one. They are the material of L2 to L4 and L7.
- **The team's day** (L10): a few moves into "Being laid" that push it over its limit; each move is listed before it is sent.
- **The site's setup** (L1, L5): the five zones (Status options), the Size field, then the Iteration field.

The game never assigns, and never writes outside `my-first-team`.

## 5. A game rule: the sprint's capacity

GitHub has no capacity for an iteration. At L5 the game asks the lead how many points the team can carry, keeps it with the player's progress, and checks the sprint against it. It is shown as the game's rule, never as a GitHub fact.

## 6. Voices

Each skill has its teacher, from the main spec's cast; every line in English and French, short, kind, never a deadline:

- **Mémé Truelle** welcomes the lead and founds the site with them (L1), and asks at the very start: "Are you here to lend a hand, or to run the site?"
- **The mayor** brings her parcels (L2) and her visits (L6, L11).
- **The inspector** with her checklist: the Definition of Ready and sizes (L3, L4).
- **Gérard the crane operator**: "I can't lift that one, it's stuck behind the other" (L7, L8).
- **The site radio**: the evening bulletin (L9).

## 7. Two paths, one book

At the start the player chooses "lend a hand" (the volunteer's path) or "run the site" (the lead's path), and can do both. The skill book shows both paths, each with its ranks and stamps; stamps never count across paths. The mentor follows the path chosen, switchable from the book.

## 8. Rewards, on the team site

- Site foreman: each yard's sign shows its count against the limit.
- Site manager: the sprint truck by the road, loaded with the sprint's pallets; the mayor's ribbon with the milestone date.
- Project director: the radio mast above the site office, broadcasting the last bulletin.

## 9. GitHub API (checked in `docs/github-api/schema.docs.graphql`, 2026-11-17)

`createRepository`, `createProjectV2` (as in the volunteer's path), `updateProjectV2Field` (Status options), `createProjectV2Field` (Size; Iteration with `iterationConfiguration`), `createIssue`, `addLabelsToLabelable`, `closeIssue` (reason duplicate), `updateProjectV2ItemFieldValue` (status, size, iteration), `addSubIssue`, `addBlockedBy`, `createProjectV2StatusUpdate`; milestones through REST only (`issues/create-milestone`, update, and the issue's milestone). Each becomes a gesture with its decision in `src/github/api-coverage.ts`.

## 10. Slices

- **5a**: choosing the path; rank Site foreman (L1 to L4).
- **5b**: rank Site manager (L5 to L8).
- **5c**: rank Project director (L9 to L11).

Each slice is an issue on board 9, played for real once on the owner's `my-first-team` (FICTIF content), reviewed independently, closed with its evidence.

## 11. Out of scope for now

- Reviewing pull requests in the game (GitHub forbids self-review; real reviews stay on GitHub).
- Fictitious accounts, or any assignment by the game.
- Applying the lead's path to a real project's board: that comes with the project picker and the test stages (main spec 15b).
