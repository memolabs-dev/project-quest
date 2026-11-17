// The game's calls to its own server. The server alone talks to GitHub.
import type {
  ApiError, ApplyResponse, LevelsView, LoggedActionView, PracticeApplyResponse, PreparedMove, PreparedPractice, SiteResponse,
} from "../shared/api.ts";
import type {
  PreparedEdit, PreparedFound, PreparedIssue, PreparedMayor, PreparedMerge, PreparedPull, PreparedTake,
} from "../shared/gestures/practice.ts";
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

/** The demo site is asked for with ?demo=1 in the page address; every API call carries it on. */
const withDemo = (path: string) => (new URLSearchParams(location.search).has("demo") ? `${path}${path.includes("?") ? "&" : "?"}demo=1` : path);

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(withDemo(path), body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const json = (await res.json()) as unknown;
  if (!res.ok) throw new ApiFailure(res.status, json as ApiError);
  return json as T;
}

/** On the practice site (?site=practice), the site and its moves are the player's own board. */
const practice = () => siteKindFromUrl(location.search) === "practice";
const moves = () => (practice() ? "/api/practice/moves" : "/api/moves");

export const api = {
  site: () => call<SiteResponse>(practice() ? "/api/site?site=practice" : "/api/site"),
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
  prepareMerge: (pullNumber: number) => call<PreparedMerge>("/api/practice/merge/prepare", { pullNumber }),
  applyPractice: (p: PreparedPractice) => call<PracticeApplyResponse>(`/api/practice/${p.kind}/apply`, p),
};
