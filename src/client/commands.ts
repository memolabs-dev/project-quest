// The git commands the Team leader types on their own machine. The game shows them; it never runs them.

/** A branch name safe to put in a command the player pastes into a shell. */
export const safeBranch = (name: string) => /^[\w./-]+$/.test(name);

export function commandsFor(level: string, repo: { nameWithOwner: string; defaultBranch: string }, branch: string): string[] {
  if (!safeBranch(branch) || !safeBranch(repo.defaultBranch)) return [];
  const name = repo.nameWithOwner.split("/")[1];
  switch (level) {
    case "a12-push-branch":
      return [
        `git clone https://github.com/${repo.nameWithOwner}.git`,
        `cd ${name}`,
        `git switch -c ${branch}`,
        "# change README.md in your editor, then:",
        'git commit -am "Describe what you changed"',
        `git push -u origin ${branch}`,
      ];
    case "a13-bring-main":
      return [`git switch ${repo.defaultBranch}`, "git pull", `git switch ${branch}`, `git merge --no-edit ${repo.defaultBranch}`, "git push"];
    case "a14-fix-from-machine":
      return ["# make the fix in README.md, then:", 'git commit -am "Fix what the inspector asked"', "git push"];
    case "a15-clean-up":
      return [`git switch ${repo.defaultBranch}`, "git pull", `git branch -d ${branch}`, `git push origin --delete ${branch}`];
    default:
      return [];
  }
}
