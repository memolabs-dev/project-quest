# project-quest: the site radio (slice 7c)

Status: written for the owner's review, 2026-11-18. Decisions taken with the owner (Guillaume) in the brainstorm of 18 November 2026. Last slice of the people of the site (`2026-11-17-people-of-the-site-design.md`, section 2); its principles (section 3) hold here. The main spec's site radio (`2026-11-16-project-quest-design.md`, section 3: "an over-excited commentator who narrates gestures live, opens the day and closes it") gets its first voice here.

## 1. Purpose

Coming back to the site, the player knows in ten seconds what moved since their last visit, without opening GitHub, told by a voice that makes them want to look. The morning radio with its quests of the day and the evening recap belong to the next project, a day on the site, which will build on this radio.

## 2. Memory: two pictures of the site

- The browser keeps a small picture of each site the player visited: the player's board, the demo, the practice and team sites, each public repository visited. The picture holds the date, each pallet's zone and state (open, laid, discarded), each building's floors, the bug pallets and the workers' logins.
- On arrival the game compares that picture with today's site, the radio speaks, and the picture is replaced by today's.
- It is kept in `localStorage` under `project-quest.radio.<site>` (the site: the board's `owner/repo`, `demo`, `practice`, `team`, or `visit:owner/repo`), with a format version: a picture of another version is ignored, as a first visit.
- The picture is written as soon as the radio has chosen its lines, even if it is muted or skipped: a reload does not repeat the same news.
- No GitHub read or write is added: the radio works only on the site already loaded.

## 3. What the radio says

- **Facts**, from the most to the least striking, five lines at most:
  1. floors laid, building by building ("Two more floors on Public map!");
  2. pallets laid ("4 pallets laid since you came by");
  3. pallets that reached inspection or are being laid;
  4. new parcels: new issues ("The mayor delivered 3 parcels");
  5. termites: new bugs, or bugs driven out;
  6. a new worker on the site ("A new helmet: lucas!"): a name, never a count.
  When there are more facts than lines, the fifth line says "and more besides".
- **Never a count per person**: "4 pallets laid", never "maria laid 3". No line holds both a login and a number.
- **Nothing invented**: each line matches a real change between the two pictures. Gags that come from no data are decoration only (a jingle, a crackle).
- **First visit**: the radio presents the site ("Welcome to the site of vitejs/vite: 7 buildings, 25 pallets at inspection!").
- **Nothing moved**: a kind line ("Dead calm, the concrete mixers are resting"), never a reproach.
- **The tone**: the over-excited commentator, with two or three variants per kind of fact, in both languages. The variant follows the date, not chance, so tests stay stable.

## 4. On the site

- **The set**: a small radio standing in front of the site office, near the foreman's starting point, built from the simple shapes already used for the truck and the rewards' mast (a box, an antenna, a grille): no new model, nothing downloaded. While it speaks, the antenna sways a little and a small light blinks; with reduced motion, only the light.
- **On arrival**: about a second after the camera's arrival, the radio crackles (a sound from the Interface Sounds pack already downloaded, nothing new), then its lines show one after another in a bubble above it, about 3 seconds each, then it falls silent.
- **A line about a pallet or a building** can be clicked: the camera glides to it, as the game's other moments do.
- **Near the radio**, the prompt says "E: listen to the radio again"; on a touch screen, "Tap the radio".
- **Manners**: the radio never speaks over an open dialog, a card or the mentor's tutorial; it waits until they are closed. A "Radio" setting (on or muted) joins the existing settings: muted, it does not speak by itself, and E still replays it.
- **Accessibility**: the bubble's text is announced to screen readers (a polite `aria-live` region); a click or Escape skips it.
- **The photo**: the radio's bubble is an HTML label like the others, so it shows on the visit's photo when taken while the radio speaks.

## 5. Units

- `snapshotOf(site: Site): SiteSnapshot`: the compact picture.
- `radioLines(before: SiteSnapshot | null, now: Site, date: string): RadioLine[]`: the lines to say, each with its text key, its values and the pallet or building it points at. Pure.
- The words live in `src/locales/en` and `fr`, with their variants.

## 6. Failures

- `localStorage` blocked (private window, browser settings): every visit counts as a first one; the radio presents the site; nothing breaks.
- A pallet reopened, deleted or moved to another repository between the two pictures: the comparison never fails, it tells only what it can name.

## 7. Testing

- **Unit**: each kind of fact; the order, the five lines and "and more besides"; no line holds a login and a number; the first visit and the dead calm; the variant follows the date; a reopened or deleted pallet; a picture of another version is ignored; `localStorage` throwing.
- **Browser (Playwright, demo site)**: the first visit's welcome; after a pallet is moved and the page reloaded, the radio tells it; E near the radio replays; muted, it does not speak by itself; it waits for an open dialog to close; with reduced motion, the antenna stays still; no new request reaches the server for the radio.
- **Online, on the public visit**, after deployment: two visits of the same repository (the welcome, then the calm or the news).
- **Measures**: draw calls before and after; the radio adds a few simple shapes.
- **For the owner**: a short video, an independent review, the issue closed with its evidence.

## 8. Out of scope

- The morning radio, the quests of the day and the evening recap (the next project, a day on the site).
- The GitHub events feed (who did what, comments, merged pull requests): the two pictures are the only source.
- Memory across computers: the picture lives in the browser.
- Spoken words (speech synthesis): the radio writes, and its jingle is its voice.
