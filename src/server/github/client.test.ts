import { describe, expect, it } from "vitest";
import { restWith } from "./client.ts";

describe("the REST door", () => {
  it("gives up after its timeout instead of hanging", async () => {
    const hang = ((_url: string, init: { signal: AbortSignal }) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    })) as unknown as typeof fetch;
    const rest = restWith("t0ken", hang, 20);
    await expect(rest("POST", "/repos/fictif/x/milestones", {})).rejects.toMatchObject({ errors: [{ message: expect.stringMatching(/did not answer/) }] });
  });
});
