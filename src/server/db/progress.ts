// Each player's stamps, tutorial events and practice repository: in Postgres for real play, in memory otherwise.
// GitHub stays the truth: a lost stamp comes back on the next check, as long as its proof still exists.
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { TutorialEvent } from "../../shared/levels/types.ts";
import { players, progress, tutorialEvents } from "./schema.ts";

export interface Stamp { levelId: string; stampedAt: string; proof: string }

export interface ProgressStore {
  stamps(login: string): Promise<Stamp[]>;
  /** Keeps the first stamp of a level: stamping again changes nothing. */
  stamp(login: string, levelId: string, proof: string): Promise<void>;
  events(login: string): Promise<TutorialEvent[]>;
  addEvent(login: string, e: TutorialEvent): Promise<void>;
  practiceRepo(login: string): Promise<string | null>;
  setPracticeRepo(login: string, name: string): Promise<void>;
}

const key = (login: string) => login.toLowerCase();

export function memoryProgress(): ProgressStore {
  const stamps = new Map<string, Stamp[]>();
  const events = new Map<string, Set<TutorialEvent>>();
  const repos = new Map<string, string>();
  return {
    async stamps(login) {
      return [...(stamps.get(key(login)) ?? [])];
    },
    async stamp(login, levelId, proof) {
      const list = stamps.get(key(login)) ?? [];
      if (!list.some((s) => s.levelId === levelId)) list.push({ levelId, proof, stampedAt: new Date().toISOString() });
      stamps.set(key(login), list);
    },
    async events(login) {
      return [...(events.get(key(login)) ?? [])];
    },
    async addEvent(login, e) {
      events.set(key(login), (events.get(key(login)) ?? new Set()).add(e));
    },
    async practiceRepo(login) {
      return repos.get(key(login)) ?? null;
    },
    async setPracticeRepo(login, name) {
      repos.set(key(login), name);
    },
  };
}

export function pgProgress(url: string): ProgressStore & { clearForTests(): Promise<void> } {
  const db = drizzle(postgres(url, { max: 5 }));
  return {
    async stamps(login) {
      const rows = await db.select().from(progress).where(eq(progress.playerLogin, key(login))).orderBy(progress.stampedAt);
      return rows.map((r) => ({ levelId: r.levelId, proof: r.proof, stampedAt: r.stampedAt.toISOString() }));
    },
    async stamp(login, levelId, proof) {
      await db.insert(progress).values({ playerLogin: key(login), levelId, proof }).onConflictDoNothing();
    },
    async events(login) {
      const rows = await db.select().from(tutorialEvents).where(eq(tutorialEvents.playerLogin, key(login)));
      return rows.map((r) => r.event as TutorialEvent);
    },
    async addEvent(login, e) {
      await db.insert(tutorialEvents).values({ playerLogin: key(login), event: e }).onConflictDoNothing();
    },
    async practiceRepo(login) {
      const [row] = await db.select({ repo: players.practiceRepo }).from(players).where(eq(players.githubLogin, key(login)));
      return row?.repo ?? null;
    },
    async setPracticeRepo(login, name) {
      await db.insert(players).values({ githubLogin: key(login), practiceRepo: name })
        .onConflictDoUpdate({ target: players.githubLogin, set: { practiceRepo: name } });
    },
    async clearForTests() {
      await db.delete(progress);
      await db.delete(tutorialEvents);
      await db.delete(players);
    },
  };
}
