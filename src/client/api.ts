// The game's calls to its own server. The server alone talks to GitHub.
import type { ApiError, ApplyResponse, LoggedActionView, PreparedMove, SiteResponse } from "../shared/api.ts";

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

export const api = {
  site: () => call<SiteResponse>("/api/site"),
  prepareMove: (itemId: string, toZone: string) => call<PreparedMove>("/api/moves/prepare", { itemId, toZone }),
  applyMove: (prepared: PreparedMove) => call<ApplyResponse>("/api/moves/apply", prepared),
  log: () => call<LoggedActionView[]>("/api/log"),
};
