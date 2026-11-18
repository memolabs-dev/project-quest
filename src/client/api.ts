// The game's calls to its own server. The server alone talks to GitHub.
import type {
  ApiError, ApplyResponse, LevelsView, LoggedActionView, PracticeApplyResponse, PreparedMove, PreparedPractice, SiteResponse, VisitResponse,
  TalkApplyResponse, WarmApplyResponse,
} from "../shared/api.ts";
import type {
  PreparedEdit, PreparedFound, PreparedIssue, PreparedMayor, PreparedMerge, PreparedPull, PreparedTake,
} from "../shared/gestures/practice.ts";
import type { PreparedAsk } from "../shared/gestures/real.ts";
import type { PreparedTeam, TeamArgs, TeamKind } from "../shared/gestures/team.ts";
import type { PreparedTalk, TalkKind } from "../shared/gestures/talk.ts";
import type { PreparedWarm, WarmKind } from "../shared/gestures/warm.ts";
import type { TutorialEvent } from "../shared/levels/types.ts";
import { siteKindFromUrl } from "./levels.ts";

export class ApiFailure extends Error {
  readonly status: number;
  readonly body: ApiError;
  constructor(status: number, body: ApiError) {
    super("message" in body ? body.message : body.error);
    this.status = status;
    this.body = body;
  }
}

/** The page address's query, empty outside a browser (unit tests run the store without one). */
export const pageSearch = () => (globalThis as { location?: { search: string } }).location?.search ?? "";

/** The demo site is asked for with ?demo=1 in the page address; every API call carries it on. */
const withDemo = (path: string) => (new URLSearchParams(pageSearch()).has("demo") ? `${path}${path.includes("?") ? "&" : "?"}demo=1` : path);

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(withDemo(path), body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  // A refusal from in front of the server (the hosted visit's rate limit answers 429 in plain text) is still read as one.
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new ApiFailure(res.status, (json as ApiError | null) ?? refusalOf(res.status));
  if (json === null) throw new ApiFailure(res.status, { error: "server", message: "The server answered without data" });
  return json as T;
}

/** What a non-JSON refusal means: too many requests is "later", anything else is the server's problem. */
export const refusalOf = (status: number): ApiError =>
  status === 429 ? { error: "busy", message: "Too many visits from here: try again in a minute" } : { error: "server", message: `The server answered ${status}` };

/** On the practice (?site=practice) or team (?site=team) site, the site and its moves are the player's own board. */
const own = () => { const k = siteKindFromUrl(pageSearch()); return k === "practice" || k === "team" ? k : null; };
const moves = () => (own() ? `/api/${own()}/moves` : "/api/moves");

/** The public repository a visit is about (?visit=owner/name), or "" when none is named yet. */
export const visitedRepo = () => (new URLSearchParams(pageSearch()).get("visit") ?? "").trim();

export { CODE_URL, EXAMPLE_REPOS, LANDING_REPO } from "../shared/visit.ts";

/** Pasted addresses are welcome: https://github.com/owner/name/issues becomes owner/name. */
export const repoFromInput = (text: string) =>
  text.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").split(/[?#]/)[0].split("/").filter(Boolean).slice(0, 2).join("/")
    .replace(/\.git$/i, "");

export const api = {
  visit: (repo: string) => call<VisitResponse>(`/api/visit?repo=${encodeURIComponent(repo)}`),
  site: () => call<SiteResponse>(own() ? `/api/site?site=${own()}` : "/api/site"),
  choosePath: (path: "volunteer" | "lead") => call<LevelsView>("/api/levels/path", { path }),
  /** The game's rule, kept with the player's progress: nothing goes to GitHub. */
  setCapacity: (points: number) => call<LevelsView>("/api/levels/capacity", { points }),
  prepareTeam: (kind: TeamKind, args: TeamArgs) => call<PreparedTeam>(`/api/team/${kind}/prepare`, args),
  applyTeam: (p: PreparedTeam) => call<PracticeApplyResponse>(`/api/team/${p.kind}/apply`, p),
  prepareMove: (itemId: string, toZone: string) => call<PreparedMove>(`${moves()}/prepare`, { itemId, toZone }),
  applyMove: (prepared: PreparedMove) => call<ApplyResponse>(`${moves()}/apply`, prepared),
  log: () => call<LoggedActionView[]>("/api/log"),
  levels: () => call<LevelsView>("/api/levels"),
  checkLevels: () => call<LevelsView>("/api/levels/check", {}),
  levelEvent: (event: TutorialEvent) => call<LevelsView>("/api/levels/event", { event }),
  prepareFound: (visibility: "PUBLIC" | "PRIVATE") => call<PreparedFound>("/api/practice/found/prepare", { visibility }),
  prepareIssue: (title: string, body: string) => call<PreparedIssue>("/api/practice/issue/prepare", { title, body }),
  prepareTake: (issueNumber: number, comment: string) => call<PreparedTake>("/api/practice/take/prepare", { issueNumber, comment }),
  prepareEdit: (issueNumber: number, content: string, message: string) =>
    call<PreparedEdit>("/api/practice/edit/prepare", { issueNumber, content, message }),
  preparePull: (issueNumber: number, title: string, why: string, branch?: string) =>
    call<PreparedPull>("/api/practice/pull/prepare", { issueNumber, title, why, branch }),
  prepareMayor: () => call<PreparedMayor>("/api/practice/mayor/prepare", {}),
  prepareAsk: (issueNumber: number, comment: string) => call<PreparedAsk>("/api/real/ask/prepare", { issueNumber, comment }),
  applyAsk: (p: PreparedAsk) => call<PracticeApplyResponse>("/api/real/ask/apply", p),
  prepareMerge: (pullNumber: number) => call<PreparedMerge>("/api/practice/merge/prepare", { pullNumber }),
  applyPractice: (p: PreparedPractice) => call<PracticeApplyResponse>(`/api/practice/${p.kind}/apply`, p),
  /** The warm gestures go to the configured project (or play on the demo site). */
  prepareWarm: (kind: WarmKind, args: { issueNumber: number; content: string; words?: string | null }) =>
    call<PreparedWarm>(`/api/warm/${kind}/prepare`, args),
  /** Answer someone who waits (number: the issue) or welcome a newcomer (number: the pull request); the lead's only. */
  prepareTalk: (kind: TalkKind, number: number, words: string) => call<PreparedTalk>(`/api/talk/${kind}/prepare`, { number, words }),
  applyTalk: (p: PreparedTalk) => call<TalkApplyResponse>(`/api/talk/${p.kind}/apply`, p),
  applyWarm: (p: PreparedWarm) => call<WarmApplyResponse>(`/api/warm/${p.kind}/apply`, p),
};
