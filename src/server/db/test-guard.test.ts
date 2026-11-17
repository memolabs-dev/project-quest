import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "./test-guard.ts";

describe("assertTestDatabase", () => {
  it("lets the clean-up run only on a database whose name ends in _test", () => {
    expect(() => assertTestDatabase("postgres://quest:quest@localhost:5442/quest_test")).not.toThrow();
    expect(() => assertTestDatabase("postgres://quest:quest@localhost:5442/quest")).toThrow(/_test/);
    expect(() => assertTestDatabase("postgres://quest:quest@localhost:5442/quest_test_old?sslmode=disable")).toThrow();
    expect(() => assertTestDatabase("not a url")).toThrow();
  });
});
