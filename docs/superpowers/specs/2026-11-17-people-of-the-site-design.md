# project-quest: the people of the site

Status: written for the owner's review, 2026-11-17. Decisions taken with the owner (Guillaume) in the brainstorm of 17 November 2026, after the research in `docs/research/2026-11-17-what-makes-a-good-game.md` (section 2, warm social play). Second of three projects to make the game more alive: the living site (done, slices 6a to 6c), **the people of the site**, then a day on the site.

## 1. Purpose

The player can be warm to the real people of the GitHub project: cheer them on, thank them when their work is laid. Success means a contributor receives small, positive signs that cost them nothing (no pressure, no ranking, no notification flood), and the player feels each warm gesture land.

## 2. Slices

- **7a, cheer and thank** (this spec, designed in full): a positive reaction on a worker's pallet; a thank-you when a pallet is laid, a reaction by default and the player's own words if they wish.
- **7b, welcome and answer**: a word of welcome on someone's first contribution (`FIRST_TIMER`, `FIRST_TIME_CONTRIBUTOR`), and an answer to a worker who waits with a question. These write comments, which notify: they get their own short brainstorm before their plan.
- **7c, the site radio**: on arrival, what happened since the last visit, from reads only, never a count per person.
- **Later**: the inspector by invitation only (people who offered to review); a credits plaque, opt-in per person.

## 3. Principles (all slices)

1. **Positive signals only.** Four emojis: 🎉 `HOORAY`, ❤️ `HEART`, 🚀 `ROCKET`, 👍 `THUMBS_UP`. Never `THUMBS_DOWN`, `CONFUSED`, `LAUGH` or `EYES`.
2. **The game never adds an @mention or an assignment.** The player may write words; the game adds nothing that notifies more.
3. **Every write is shown, then confirmed** (project rule). A reaction is taken back the same way.
4. **No ranking, no count per person, no points per gesture** (research: rewards for writes bring volume; GitHub Achievements and Hacktoberfest backfired). The player gets the moment, and a stamp in the skill book the first time.
5. **Low volume**: at most one reaction of each kind per pallet (GitHub's own rule), never a batch.
6. **Open from the start** to every player, volunteer or lead: a reaction is harmless (no notification, taken back in one click).
7. **Testing follows the project's three stages**: the fictitious sandbox only (`memolabs-dev/project-quest-sandbox`, board 10) until the owner says otherwise.

## 4. Cheer (slice 7a)

- **On whom**: a worker, on the open pallet they carry and stand by (the lowest open one, as the scene already places them). A pallet with no worker can be cheered from its card too.
- **In the scene**: when the foreman is within 4 m of a worker, the hint shows "R: cheer maria" (physical key `KeyR`, the player's own letter shown as for E). R opens the four emojis above the worker.
- **On the card**: the same four buttons, for mouse, touch and keyboard.
- **What is sent**: `addReaction` on the issue (`subjectId` the issue's node id, `content` one of the four). Nothing else.
- **Taking it back**: an emoji the player already gave shows as ticked; clicking it again offers `removeReaction`, through the same confirmation.

## 5. Thank (slice 7a)

- **When**: a pallet has just been laid (issue closed as completed), by the player or by someone else. After the floor-laid moment, the game offers "Thank maria?" (with several assignees, their logins; with none, "Thank the team?"). The same gesture stays on the card of any laid pallet.
- **What is sent**: by default a reaction (🎉 or ❤️, the player picks), no notification. If the player wishes, words they write themselves: `addComment` on the issue, read back before it is sent.
- **@mentions**: the game never adds one. If the player's own text holds one, the confirmation says so plainly: "These words will notify @x."
- **One comment per pallet per player**: the game remembers it in the action log; the words field is gone once they are sent. Reactions stay possible.

## 6. Reads, writes and failures

- **Reads**: per issue on the board, only the reactions the player already gave (`reactionGroups { content viewerHasReacted }`), to tick their emojis. One more field in the existing board read; never a count of reactions per person.
- **Writes**, the same path as moving a pallet: *prepare* builds exactly what will be sent (the issue, the emoji or the text); the confirmation shows it; nothing leaves without the player's click; *apply* rebuilds it from a fresh read of the issue, sends it, and writes the action log. The browser never holds a token. On the demo site everything plays and nothing is sent.
- **Refused by GitHub** (issue locked, rights missing, rate limit): the pallet gives its small "bonk", the message says why, no celebration.
- `src/github/api-coverage.ts` already decides `addReaction`, `removeReaction` and `addComment` as gestures; their wording is updated to these gestures.

## 7. The moment and the stamp (slice 7a)

- **Cheer**, once GitHub accepted (never before): the worker turns to the foreman and waves (`Interact`); the chosen emoji rises above their head and fades in about a second; a soft, clear sound; the foreman raises a thumb. The sound is one already in the game or from the Kenney packs already downloaded: nothing new is downloaded without the owner's approval.
- **Thank**: the same, warmer: the worker cheers (`Cheer`).
- **Reduced motion**: no rising, no gesture; the emoji simply shows beside the badge; the sound stays.
- **Taking a reaction back**: no moment, only the confirmation.
- **The stamp**: two new entries in the skill book, "Cheer" and "Thank", each stamped the first time the gesture really leaves for GitHub, with the issue's address as proof; then nothing, no counter. The server records it, as it records the game's other events.

## 8. Testing

- **The sandbox**: its issues have no assignee today, so there is no worker to cheer. The seed script (`scripts/seed-sandbox.ts`) assigns the owner's own account to two FICTIF issues: he asks for them himself, so the rule "never assign someone who did not ask" holds. He cheers himself in the real run; GitHub allows it.
- **Unit**: only the four positive emojis are accepted; prepare shows exactly the issue and the emoji; taking back is offered only for an emoji already given; words with an @mention carry the warning; a second comment on the same pallet is refused; a refusal from GitHub never celebrates; the stamp falls the first time only.
- **Browser (Playwright, demo site)**: R near a worker shows the confirmation with the reaction, nothing leaves, the emoji is ticked afterwards; after a pallet is laid, "Thank" is offered; with reduced motion, no rising emoji.
- **Real run** on the sandbox, the owner approving each write: a reaction, taking it back, a thank-you with words.
- **Measures** before and after: draw calls and frame rate barely move.
- **For the owner**: a short video, an independent review, the issue closed with its evidence once seen.

## 9. Out of scope for 7a

- Welcome, answers, the radio, the inspector, the plaque (slices 7b, 7c, later).
- Reactions on comments (only on issues for now).
- Any count of reactions shown in the game.
