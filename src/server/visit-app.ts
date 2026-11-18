// The visit of a public repository (#16), as its own small app: the game's server mounts it, and the public
// server (prod.ts) serves it alone, so a hosted visit has no write route at all.
import { Hono } from "hono";
import { buildSite } from "../shared/site.ts";
import { GitHubAuthError } from "./github/client.ts";
import { REPO_PATTERN, RepoNotPublicError, visitConfig, type Visit } from "./github/read-repo.ts";

/** One read per repository per ten minutes, whoever visits: a busy day never spends the token's quota. */
export function visitCache(read: (repo: string) => Promise<Visit>, { ttlMs = 10 * 60_000, max = 200, now = Date.now } = {}) {
  const kept = new Map<string, { at: number; visit: Promise<Visit> }>();
  return {
    read(repo: string): Promise<Visit> {
      const key = repo.toLowerCase();
      const hit = kept.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.visit;
      kept.delete(key);
      // A failed read is forgotten at once, so the next visitor asks GitHub again; "not public" is an answer and is kept,
      // or asking for missing repositories one after another would spend the hour's reads.
      const visit = read(repo).catch((e: unknown) => { if (!(e instanceof RepoNotPublicError)) kept.delete(key); throw e; });
      kept.set(key, { at: now(), visit });
      // The oldest visit leaves first (a Map keeps insertion order).
      while (kept.size > max) kept.delete(kept.keys().next().value!);
      return visit;
    },
  };
}

/** GitHub is asked at most `perHour` times in the last hour (cached visits are free): the token can never be drained. */
export function readBudget(perHour: number, now = Date.now) {
  const asked: number[] = [];
  return {
    take(): boolean {
      const since = now() - 60 * 60_000;
      while (asked.length && asked[0] <= since) asked.shift();
      if (asked.length >= perHour) return false;
      asked.push(now());
      return true;
    },
  };
}

export class VisitBusyError extends Error {}

export interface VisitOptions { readsPerHour?: number; ttlMs?: number; now?: () => number }

export function createVisitApp(read: (repo: string) => Promise<Visit>, { readsPerHour = 600, ttlMs, now = Date.now }: VisitOptions = {}) {
  const budget = readBudget(readsPerHour, now);
  const visits = visitCache((repo) => {
    if (!budget.take()) return Promise.reject(new VisitBusyError("Many visits right now: try again in a few minutes"));
    return read(repo);
  }, { ttlMs, now });
  return new Hono()
    .onError((err, c) => {
      if (err instanceof RepoNotPublicError) return c.json({ error: "not-public" as const, message: err.message }, 404);
      if (err instanceof VisitBusyError) return c.json({ error: "busy" as const, message: err.message }, 429);
      // GitHub refusing (its rate limit answers 403) or not answering in time: the visitor hears "later", never a login hint.
      if (err instanceof GitHubAuthError || err.name === "TimeoutError" || err.name === "AbortError") {
        console.error("[project-quest] GitHub did not answer the visit:", err.name, err.message);
        return c.json({ error: "busy" as const, message: "GitHub is not answering right now: try again in a few minutes" }, 503);
      }
      console.error(err);
      return c.json({ error: "server" as const, message: "Something went wrong on the server" }, 500);
    })
    // Nothing can be written from a visit: this app has no other route.
    .get("/api/visit", async (c) => {
      const repo = (c.req.query("repo") ?? "").trim();
      if (!REPO_PATTERN.test(repo)) return c.json({ error: "not-public" as const, message: "Write the repository as owner/name" }, 400);
      const visit = await visits.read(repo);
      return c.json({ site: buildSite(visit.board, visitConfig(visit.repo.nameWithOwner)), repo: visit.repo });
    });
}
