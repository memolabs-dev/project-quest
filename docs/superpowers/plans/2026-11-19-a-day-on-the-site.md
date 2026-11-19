# A day on the site: plan (slice 8)

Spec: `docs/superpowers/specs/2026-11-19-a-day-on-the-site-design.md`. Small commits on `main`, `npm run check` before each push.

1. **`src/client/day.ts`, pure, with its tests**: `Job` (`answer`, `welcome`, `thank`, `unstick`, each with its pallet or pull request number and login); `dayJobs(site, toThank)`; `jobDone(job, site, thanked)`; the stored day (`OpenDay`: date, the radio's picture of the morning, jobs, done) and pages (`DayPage`); `loadDay`, `saveDay`, `closeDay` (writes the page, keeps 30), `loadDays`, all in a `try`, with the storage passed in for the tests.
2. **The store**: `day: OpenDay | null`, `days: DayPage[]`, `startDay()`, `tickDay()` (marks the jobs whose fact is seen, after each site change and each accepted thank-you or "not now"), `endDay()`, `nearOffice`. A thanked pallet is remembered for the day (`thanked`).
3. **The radio**: after its news, one line for the morning (`day.morning` with the count, `day.free`, `day.resumed`), and the evening lines (`radioLines(morning picture, site)` then `day.evening` with done and count). Only on the demo and the configured board.
4. **The day's board** (`src/client/ui/DayBoard.tsx`): the jobs, ticked when done, each opening its card or the welcome; "Close the day"; foldable; in both languages.
5. **The office**: `Player` sets `nearOffice` like the radio (nearer than any pallet, visitor or the radio); E closes the day there; the prompt says so; a click on the office does too.
6. **The logbook**: a "Days" heading over the existing rows, the pages newest first.
7. **Browser test** (`e2e/day.spec.ts`, demo): the morning line and the board; moving the stuck pallet ticks its job; closing at the office; the evening line; the page in the logbook; a reload takes the day up.
8. **Real run** on the sandbox board, video, review, issue closed with its evidence, Vault note.
