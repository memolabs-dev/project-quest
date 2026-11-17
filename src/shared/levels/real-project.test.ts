import { describe, expect, it } from "vitest";
import { REAL_PROJECT } from "./real-project.ts";
import type { Observed, RealSnapshot } from "./types.ts";

const a16 = REAL_PROJECT[0];
const VIEWER = "fictif-volunteer";
const real = (comments: { author: string; url: string; createdAt?: string }[]): RealSnapshot => ({
  repo: "fictif-org/fictif-site",
  issues: [{ id: "I_21", number: 21, title: "FICTIF fountain", url: "u21", assignees: [], comments: comments.map((c) => ({ createdAt: "2026-11-17T12:00:00Z", ...c })) }],
});
const seen = (r: RealSnapshot | null): Observed => ({ viewer: VIEWER, events: [], practice: null, real: r, realSince: "2026-11-17T10:00:00Z" });

describe("a16-ask-good-first", () => {
  it("is the real project's level", () => {
    expect(REAL_PROJECT.map((l) => l.id)).toEqual(["a16-ask-good-first"]);
    expect(a16.rank).toBe("real-project");
  });
  it("passes on the viewer's comment on an open good first issue, proof the comment", () => {
    expect(a16.check(seen(real([{ author: "Fictif-Volunteer", url: "c1" }])))).toEqual({ done: true, proof: "c1" });
  });
  it("counts only a comment on an open good-first issue", () => {
    expect(a16.check(seen(real([{ author: "someone-else", url: "c2" }]))).done).toBe(false);
    expect(a16.check(seen({ repo: "fictif-org/fictif-site", issues: [] })).done).toBe(false);
  });
  it("ignores a comment written before level 16 began", () => {
    expect(a16.check(seen(real([{ author: VIEWER, url: "old", createdAt: "2026-11-01T09:00:00Z" }]))).done).toBe(false);
  });
  it("is not done before the real project is read", () => {
    expect(a16.check(seen(null)).done).toBe(false);
  });
});
