# project-quest: a day on the site (slice 8)

Status: written for the owner's review, 2026-11-19. Decisions taken with the owner (Guillaume) on 19 November 2026. It builds the game loop of the main spec (`2026-11-16-project-quest-design.md`, section 5) on the site radio (`2026-11-18-site-radio-design.md`), in its simplest version that plays in one go.

## 1. Purpose

One session is one working day on the site. In the morning the radio gives three jobs for the day, taken from what the board really lacks. The player does them with the gestures the game already has. When they want, they close the day at the site office: the radio sums up what moved, and a page of the logbook keeps the day.

## 2. Decisions (owner, 2026-11-19)

- **Where**: the demo site and the configured board (the lead's real project). Not the practice and team sites (the levels lead them), not the public visit (read only).
- **The jobs**: only real gaps of the board, never an invented task.
- **The end**: the player closes the day, at the site office, when they want. No timer.
- **What is kept**: a page of the logbook per day: its date, its jobs and whether they were done, what moved. Never a comparison with anyone, no streak of days.

## 3. The jobs of the day

At most three, one per person or pallet, from the site as loaded. A varied day: the first job of each kind, in this order, then the most pressing of the rest:

1. **Answer**: someone waits for an answer (the lead's signs, `people.waiting`). Done when they no longer wait.
2. **Welcome**: a newcomer's first pull request (`people.newcomers`). Done when the welcome was sent (they leave the list).
3. **Thank**: a pallet laid since the last visit and not yet thanked (`toThank`). Done when GitHub accepted the thank-you, or when the player said "not now" (it is the player's choice, not a duty).
4. **Unstick**: the oldest open pallet in the stock (the first zone) that nobody carries, the lowest number being the oldest. Done when it left the stock.

When the board has fewer gaps, the day has fewer jobs; with none, the radio says the site is in order and the day is free. A job is done by a fact seen on the site (or GitHub's answer for a thank-you), never by a click on the list.

No job asks anything of a contributor: they are the lead's own gestures (principle "no pressure on contributors").

## 4. The morning

- The day starts on the first arrival when no day is open for this site. The radio says its news as today, then one more line: "Three jobs today, they are on the board by the office" (or "The site is in order: a free day").
- **The day's board**: a small panel on screen, under the settings, lists the jobs with their pallet number. Each line opens its pallet's card (or the newcomer's welcome). A done job is ticked. The panel can be folded.
- A day left open (the page closed in the afternoon) is taken up on the next arrival with its own jobs, whatever the date; the radio says "Back to work: 2 jobs left".

## 5. The evening

- Near the site office, the prompt says "E: close the day"; on a touch screen, "Tap the office". The day's board also has a "Close the day" button.
- Closing writes nothing to GitHub, so there is no confirmation: the radio speaks the evening lines, what moved between the morning's picture and now (the radio's own comparison), and "2 of 3 jobs done". A day with no job done is told kindly, never as a reproach.
- The radio stands by the spawn, far from the office: the same evening lines are written on the day's board, where the player stands, until they fold them away ("See you tomorrow").
- The page joins the logbook, under a "Days" heading: day n, its date, each job and whether it was done, the evening lines.
- The next arrival starts a new day.

## 6. Storage

- In the browser, like the radio's picture: `project-quest.day.<site>` holds the open day (its date, the morning's picture, its jobs), `project-quest.days.<site>` the closed pages, the 30 most recent. The site is `demo` or the board's key, as the radio's.
- Read in a `try`: storage blocked, each arrival starts a new day and no page is kept; nothing breaks.
- No new GitHub read or write, no server change.

## 7. Units

- `dayJobs(site, toThank): Job[]`: the jobs to give, in order, three at most. Pure.
- `jobDone(job, site, thanked): boolean`: whether a job is done on this site. Pure.
- `openDay`, `closeDay`, `loadDays`: the storage helpers, like the radio's.
- The words live in `src/locales/en` and `fr`.

## 8. Failures

- A job's pallet deleted or moved to another repository: the job is done when its gap is gone, so it counts as done; the page says so as for any other.
- The demo's state is shared in memory between tabs: two tabs see the same facts, each keeps its own day.

## 9. Testing

- **Unit**: the order of the jobs and the three at most; a free day; each kind of job done by its fact; the thank-you's "not now"; a day taken up; closing writes a page and the next arrival starts a new day; 30 pages at most; storage throwing.
- **Browser (Playwright, demo site)**: the morning line and the day's board; a job done by a real gesture on the demo (moving the stuck pallet); closing at the office, the evening line, the page in the logbook; a reload takes the open day up.
- **A real run** on the configured sandbox board (`memolabs-dev/project-quest-sandbox`, FICTIF issues), as for every slice.
- **For the owner**: a short video, an independent review, the issue closed with its evidence.

## 10. Out of scope

- The project's "weather" and Grisaille & Lenteur's bet gauge.
- The evening bulletin from the office (it exists as the lead's gesture on the team site).
- The mayor's visit at a milestone, chapters.
- A job for a task with no news for 7 days (the site does not carry each issue's last update yet).
