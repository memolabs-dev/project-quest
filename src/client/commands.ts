// The git commands the Team leader types on their own machine. The game shows them; it never runs them.

/** A branch name safe to put in a command the player pastes into a shell. */
export const safeBranch = (name: string) => /^[\w./-]+$/.test(name);

const ENGLISH: Record<string, string> = {
  "commands.editReadme": "change README.md in your editor, then:",
  "commands.describeChange": "Describe what you changed",
  "commands.makeFix": "make the fix in README.md, then:",
  "commands.fixInspector": "Fix what the inspector asked",
};

/** A commit message the shell takes as plain text inside double quotes: no double quote, dollar, backtick, backslash or bracket. */
const plain = (text: string) => text.replace(/["`$\\()]/g, "").replace(/\s+/g, " ").trim();

/** say: the player's words for the steps and the commit messages (English by default). */
export function commandsFor(
  level: string, repo: { nameWithOwner: string; defaultBranch: string }, branch: string, say: (key: string) => string = (k) => ENGLISH[k] ?? k,
): string[] {
  if (!safeBranch(branch) || !safeBranch(repo.defaultBranch)) return [];
  const name = repo.nameWithOwner.split("/")[1];
  const commit = (key: string) => `git commit -am "${plain(say(key))}"`;
  switch (level) {
    case "a12-push-branch":
      return [
        `git clone https://github.com/${repo.nameWithOwner}.git`,
        `cd ${name}`,
        `git switch -c ${branch}`,
        `# ${say("commands.editReadme")}`,
        commit("commands.describeChange"),
        `git push -u origin ${branch}`,
      ];
    case "a13-bring-main":
      return [`git switch ${repo.defaultBranch}`, "git pull", `git switch ${branch}`, `git merge --no-edit ${repo.defaultBranch}`, "git push"];
    case "a14-fix-from-machine":
      return [`# ${say("commands.makeFix")}`, commit("commands.fixInspector"), "git push"];
    case "a15-clean-up":
      return [`git switch ${repo.defaultBranch}`, "git pull", `git branch -d ${branch}`, `git push origin --delete ${branch}`];
    default:
      return [];
  }
}
