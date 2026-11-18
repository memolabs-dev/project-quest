# project-quest: welcome and answer (slice 7b)

Status: written for the owner's review, 2026-11-18. Decisions taken with the owner (Guillaume) in the brainstorm of 18 November 2026. Part of the people of the site (`2026-11-17-people-of-the-site-design.md`, slice 7b); its principles (section 3) hold here.

## 1. Purpose

Newcomers leave when nobody answers them, or answers coldly (research, `docs/research/2026-11-17-what-makes-a-good-game.md`, section 2). The lead sees, on the site, who waits for an answer and who just made a first contribution, and answers them in their own words, quickly. Success means a real person gets a real human word at the right moment, and rarely: the game never becomes a machine that posts comments.

## 2. Answer someone who waits

- **Who waits**: on an issue of the board, the last comment comes from someone who is neither the player nor the team, and nobody from the team wrote since, for more than 24 hours. The team is `OWNER`, `MEMBER` and `COLLABORATOR` (GitHub's `authorAssociation`), plus the player. No question mark is required: many asks have none ("can I take this one", "it fails on my machine"). The 24 hours are a constant in the code, not a setting.
- **What is sent**: one comment on the issue (`addComment`), from a short draft in the player's language: the first words of the waiting comment quoted (`> ...`), then an empty line for the player's answer. The game never answers the substance for the player.
- **No @mention added**: the person is subscribed to the issue since they wrote in it, so they are notified without one. If the player's own words hold a mention, the confirmation says so, as for the thank-you.
- **Afterwards**: the last word is the team's, so the sign goes away by itself. GitHub is the memory; the game keeps nothing apart.

## 3. Welcome a newcomer

- **Who**: the author of an open pull request that GitHub marks as a first contribution (`authorAssociation` `FIRST_TIMER` or `FIRST_TIME_CONTRIBUTOR`). Nothing is guessed and no history is read. A first comment such as "can I take this one?" is covered by section 2.
- **What is sent**: one comment on the pull request (`addComment`), from a warm, editable draft in the player's language: thanks for this first contribution, someone will review it, and a link to the repository's `CONTRIBUTING.md` when it exists.
- **Once per person**: if the player already commented on that pull request (`viewerDidAuthor`), the gesture is gone.

## 4. Who can, and where

- **The lead only, on the real project**: the gestures open once the player follows the lead's path and holds its first rank, Site foreman (`site-foreman`, "Contremaître"). A volunteer does not answer in the team's name, and does not see the signs (they would invite a gesture that is not theirs).
- **The demo site**: an invented waiting comment and an invented newcomer (marked `FICTIF`), playable by everyone; nothing is sent.
- **The public visit**: no signs. Showing a stranger's repository with "someone has waited 3 days here" would put pressure on its maintainers.

## 5. On the site

- **Signs**: a "?" bubble above a pallet where someone waits, with their login and how long ("maria · 2 d"); a "👋" bubble above the pallet that a newcomer's first pull request will close. A first pull request linked to no issue has no pallet: its author stands as a visitor in front of the site office, with the 👋 bubble, drawn with the existing worker model. Bubbles are HTML labels like the signs, so they are cheap and show on the photo.
- **The gesture**: near the pallet or the visitor, the prompt says "E: answer maria" or "E: welcome lucas"; the pallet's card holds the same button for mouse and touch. A dialog shows what the person wrote (their comment, or their pull request's title and link), then the editable draft. The confirmation shows the exact text, the issue or pull request, and the mention warning.
- **The moment**, once GitHub accepted (never before): the person turns to the foreman and waves (`Interact`), the bubble fades with a sound already in the game. With reduced motion: the sound, and the bubble goes.
- **The stamp**: two entries in the skill book, "Welcome" and "Answer", stamped the first time the gesture really leaves for GitHub, with the comment's address as proof; then nothing, no counter.

## 6. Reads, writes and failures

- **Reads**, on the real project of a lead only:
  - per issue on the board, its last comment: author, `authorAssociation`, `createdAt`, the first 200 characters. One more field in the existing board read.
  - the repository's open pull requests whose author is marked as a first contribution, with `closingIssuesReferences` and whether the player already commented. One query, at most 50 pull requests.
- **Writes**, the path of every gesture: *prepare* builds the exact comment; the confirmation shows it; nothing leaves without the player's click; *apply* rebuilds it from a fresh read and sends it, and writes the action log. If the team answered meanwhile, or the newcomer was already welcomed, nothing is sent and the player is told why. The browser never holds a token.
- **Refused by GitHub** (locked issue, missing rights, rate limit): the pallet's "bonk", the message says why, no celebration.
- `src/github/api-coverage.ts` already decides `addComment` as a gesture; its wording is updated.

## 7. Testing

- **Unit**: the waiting rule (team or not, the 24 hours, the player's own last word); the newcomer rule (the two associations, the player already commented); prepare shows exactly the target and the text; apply refuses when the team answered or the newcomer was welcomed meanwhile; the mention warning; the gestures and signs are the lead's only; the stamp falls the first time only.
- **Browser (Playwright, demo site)**: the bubbles show; E near the pallet opens the dialog with the draft; the confirmation shows the text; nothing leaves; the bubble goes afterwards; with reduced motion, no wave.
- **Real run: not now.** Both gestures aim at someone outside the team, and on the sandbox the owner is `OWNER`: neither his comment nor his pull request starts anything. A real run needs a second GitHub account. The owner left the choice to the agent, who chose to do without for now: the slice is checked by unit and browser tests and reported **unverified on GitHub**; the real run comes with the tests' second stage (the copy of the SOS MEDITERRANEE project), where real people ask and contribute.
- **For the owner**: a short video on the demo, an independent review, the issue closed with its evidence, the real run listed as still open.

## 8. Out of scope

- Answering a review comment on a pull request, or a discussion: issues and pull requests only.
- Any automatic comment, reminder or scheduled message.
- Signs on the public visit.
- The radio (slice 7c), the inspector by invitation, the credits plaque.
