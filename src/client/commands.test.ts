import { describe, expect, it } from "vitest";
import { commandsFor } from "./commands.ts";

const repo = { nameWithOwner: "fictif-volunteer/my-first-site", defaultBranch: "main" };

describe("commandsFor", () => {
  it("writes the clone, branch, commit and push commands", () => {
    const c = commandsFor("a12-push-branch", repo, "work-3");
    expect(c).toContain("git clone https://github.com/fictif-volunteer/my-first-site.git");
    expect(c).toContain("cd my-first-site");
    expect(c).toContain("git switch -c work-3");
    expect(c.some((l) => l.startsWith("git commit -am "))).toBe(true);
    expect(c.at(-1)).toBe("git push -u origin work-3");
  });
  it("brings main in with the default branch's real name", () => {
    const c = commandsFor("a13-bring-main", { ...repo, defaultBranch: "trunk" }, "work-3");
    expect(c).toEqual(["git switch trunk", "git pull", "git switch work-3", "git merge trunk", "git push"]);
  });
  it("pushes a fix, then sweeps the branch away", () => {
    expect(commandsFor("a14-fix-from-machine", repo, "work-3").at(-1)).toBe("git push");
    expect(commandsFor("a15-clean-up", repo, "work-3")).toEqual(["git switch main", "git pull", "git branch -d work-3", "git push origin --delete work-3"]);
  });
  it("has no commands for a level played in the game", () => {
    expect(commandsFor("a5-write-issue", repo, "work-3")).toEqual([]);
  });
});
