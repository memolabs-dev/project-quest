import { describe, expect, it } from "vitest";
import type { QuestConfig } from "../../shared/config.ts";
import { readThanked } from "./read-thanked.ts";

const config = { owner: "memolabs-dev", repo: "project-quest-sandbox" } as QuestConfig;
const answer = (closedAt: string | null, comments: { createdAt: string; viewerDidAuthor: boolean }[]) =>
  (async () => ({ repository: { issue: { closedAt, comments: { nodes: comments } } } })) as never;

describe("readThanked", () => {
  it("a comment of the player's after the close is a thank-you", async () => {
    expect(await readThanked(answer("2026-11-19T10:00:00Z", [{ createdAt: "2026-11-19T10:05:00Z", viewerDidAuthor: true }]), config, 1)).toBe(true);
  });
  it("a comment of the very second it closed counts (Close with comment): never a second thank-you", async () => {
    expect(await readThanked(answer("2026-11-19T10:00:00Z", [{ createdAt: "2026-11-19T10:00:00Z", viewerDidAuthor: true }]), config, 1)).toBe(true);
  });
  it("someone else's comment, or an open issue, is no thank-you", async () => {
    expect(await readThanked(answer("2026-11-19T10:00:00Z", [{ createdAt: "2026-11-19T10:05:00Z", viewerDidAuthor: false }]), config, 1)).toBe(false);
    expect(await readThanked(answer(null, [{ createdAt: "2026-11-19T10:05:00Z", viewerDidAuthor: true }]), config, 1)).toBe(false);
  });
});
