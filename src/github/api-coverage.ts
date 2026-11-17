// Every GitHub API operation has a decision here: a game gesture, a read that builds the world,
// a later phase, or out of scope with its reason. Nothing is forgotten silently:
// api-coverage.test.ts fails when an operation of docs/github-api/inventory.json has no decision.
//
// Categories in REVIEWED_ONE_BY_ONE have no default: each of their operations is decided by name.
// Every other category gets one decision for the whole category, with its reason.

export type Phase = "v1" | "v2-contributors" | "v3-live" | "idea";
export type Decision =
  | { kind: "gesture"; gesture: string; phase: Phase }
  | { kind: "read"; shows: string; phase: Phase }
  | { kind: "later"; phase: Exclude<Phase, "v1">; why: string }
  | { kind: "out"; why: string };

const gesture = (g: string, phase: Phase = "v1"): Decision => ({ kind: "gesture", gesture: g, phase });
const read = (shows: string, phase: Phase = "v1"): Decision => ({ kind: "read", shows, phase });
const later = (phase: Exclude<Phase, "v1">, why: string): Decision => ({ kind: "later", phase, why });
const out = (why: string): Decision => ({ kind: "out", why });
const all = (ids: string[], d: Decision) => Object.fromEntries(ids.map((id) => [id, d]));
const m = (names: string[]) => names.map((n) => `graphql.mutation.${n}`);
const q = (names: string[]) => names.map((n) => `graphql.query.${n}`);
const r = (names: string[]) => names.map((n) => `rest.${n}`);

/** Categories decided operation by operation, because the game lives in them. */
export const REVIEWED_ONE_BY_ONE = [
  "graphql:issues", "graphql:projects", "graphql:pulls", "graphql:discussions", "graphql:reactions",
  "graphql:activity", "graphql:users", "graphql:meta",
  "rest:issues", "rest:projects", "rest:pulls", "rest:reactions", "rest:search", "rest:activity",
  "rest:rate-limit", "rest:meta", "rest:markdown",
] as const;

/** The game writes through GraphQL. A REST twin of a mutation we already use is not used twice. */
const REST_TWIN = "REST twin of a GraphQL operation the game already uses; one write path keeps the action log simple";
const SITE_SETUP = "Sets up the board itself (fields, views, workflows, templates): done once on GitHub, not a daily site gesture";
const NOT_A_BOARD_THING = "Not part of managing the board";

export const OPERATIONS: Record<string, Decision> = {
  // ---------- GraphQL: issues (the pallets) ----------
  ...all(m(["createIssue"]), gesture("Order a new pallet: the lead writes a delivery note, it lands in the stock")),
  ...all(m(["updateIssue"]), gesture("Rewrite a delivery note, tick the inspector's checklist (DoR), place a pallet under a milestone crane")),
  ...all(m(["closeIssue"]), gesture("Lay the last floor: close as completed (the magic moment); or send a duplicate or a not-planned pallet back")),
  ...all(m(["reopenIssue"]), gesture("A crack in a floor: reopen a closed pallet")),
  ...all(m(["setIssueStatus"]), out("Same effect as closeIssue and reopenIssue, which the game uses")),
  ...all(m(["addComment"]), gesture("Talk to a worker (wake the one in the hammock, answer a question): a comment, read back before it is sent")),
  ...all(m(["updateIssueComment"]), gesture("Fix what you said: edit your own comment")),
  ...all(m(["deleteIssueComment"]), out("Deleting a comment loses history; the game never deletes what people wrote")),
  ...all(m(["addAssigneesToAssignable"]), gesture("Hand a pallet to the worker who asked for it (\"je prends\"), or take it yourself")),
  ...all(m(["removeAssigneesFromAssignable"]), gesture("Free a pallet nobody is carrying any more (back to the stock)")),
  ...all(m(["replaceActorsForAssignable"]), later("idea", "Assigns agents and bots as well as people; useful once agents work on the site")),
  ...all(m(["addLabelsToLabelable"]), gesture("Tag a pallet (trade, level, bug) and catch the termites: bug triage")),
  ...all(m(["removeLabelsFromLabelable"]), gesture("Remove a wrong tag")),
  ...all(m(["clearLabelsFromLabelable"]), out("Clears every label at once; too blunt for a gesture, removeLabelsFromLabelable does it one by one")),
  ...all(m(["createLabel", "updateLabel", "deleteLabel"]), out(SITE_SETUP)),
  ...all(m(["addSubIssue"]), gesture("Deliver the mayor's parcel to the right building: attach the issue to its epic")),
  ...all(m(["removeSubIssue"]), gesture("Move a parcel to another building")),
  ...all(m(["reprioritizeSubIssue"]), gesture("Reorder the pallets of a building")),
  ...all(m(["addBlockedBy"]), gesture("Rope two pallets: this one waits for that one (Gérard's crane is busy)")),
  ...all(m(["removeBlockedBy"]), gesture("Cut the rope: the pallet no longer waits")),
  ...all(m(["addRelatesTo", "removeRelatesTo"]), gesture("Link two related pallets (a dotted chalk line)")),
  ...all(m(["unmarkIssueAsDuplicate"]), gesture("Bring back a pallet wrongly sent back as a duplicate")),
  ...all(m(["updateIssueIssueType"]), gesture("Say what a pallet is: task, feature, bug, epic")),
  ...all(m(["createIssueType", "updateIssueType", "deleteIssueType"]), out(SITE_SETUP)),
  ...all(m(["createIssueField", "updateIssueField", "deleteIssueField"]), out(SITE_SETUP)),
  ...all(m(["createIssueFieldValue", "updateIssueFieldValue", "setIssueFieldValue", "deleteIssueFieldValue"]),
    later("idea", "Organisation-level issue fields; the game reads board fields (Projects v2) first")),
  ...all(m(["pinIssue", "unpinIssue"]), gesture("Pin a pallet on the site noticeboard (the repository's pinned issues)")),
  ...all(m(["pinIssueComment", "unpinIssueComment"]), later("idea", "Pin the key comment of a discussion on a pallet")),
  ...all(m(["lockLockable", "unlockLockable"]), later("v2-contributors", "Calm a heated thread; a moderation gesture that needs care and its own design")),
  ...all(m(["minimizeComment", "unminimizeComment"]), later("v2-contributors", "Hide spam or an off-topic comment; moderation, designed with lockLockable")),
  ...all(m(["transferIssue"]), out("Moves an issue to another repository; rare and outside one site")),
  ...all(m(["deleteIssue"]), out("Destroys history; the game closes as not planned instead")),
  ...all(m(["createLinkedBranch", "deleteLinkedBranch"]), later("v2-contributors", "A worker starts a branch from their pallet; a contributor gesture")),
  ...all(m(["addCloseIssueReferences", "removeCloseIssueReferences"]), later("v2-contributors", "Link a pull request to the pallet it finishes")),
  ...all(m(["applyPendingIssueSuggestions", "rejectPendingIssueSuggestions"]), later("idea", "GitHub's own suggestions on an issue; could become the mayor's advisor")),

  // ---------- GraphQL: projects (the board, the site plan) ----------
  ...all(m(["updateProjectV2ItemFieldValue"]), gesture("Push a pallet to another zone (status column), load it on the sprint truck (iteration), set its size")),
  ...all(m(["clearProjectV2ItemFieldValue"]), gesture("Unload a pallet from the sprint truck, clear its size")),
  ...all(m(["updateProjectV2ItemPosition"]), gesture("Reorder a zone: put the most urgent pallet in front")),
  ...all(m(["addProjectV2ItemById"]), gesture("Bring a pallet onto the site: add an issue or PR to the board")),
  ...all(m(["addProjectV2DraftIssue", "updateProjectV2DraftIssue"]), gesture("Chalk a sketch on the site board: a draft item")),
  ...all(m(["convertProjectV2DraftIssueItemToIssue"]), gesture("Turn a chalk sketch into a real pallet (an issue)")),
  ...all(m(["archiveProjectV2Item", "unarchiveProjectV2Item"]), gesture("Clear finished pallets to the archive yard, or bring one back")),
  ...all(m(["deleteProjectV2Item"]), out("Removes an item from the board for good; archiving does the job without loss")),
  ...all(m(["createProjectV2StatusUpdate", "updateProjectV2StatusUpdate"]), gesture("The evening bulletin: post the board's status update (on track, at risk) after the radio recap")),
  ...all(m(["deleteProjectV2StatusUpdate"]), out("Deletes a published bulletin; the game corrects it instead")),
  ...all(m(["createRepository", "createProjectV2"]), gesture("Found your practice site: your own repository and its board, in your account (levels, Apprentice rank)")),
  ...all(m(["copyProjectV2", "deleteProjectV2", "updateProjectV2", "markProjectV2AsTemplate", "unmarkProjectV2AsTemplate"]), out(SITE_SETUP)),
  ...all(m(["createProjectV2Field", "createProjectV2IssueField", "updateProjectV2Field", "deleteProjectV2Field"]), out(SITE_SETUP)),
  ...all(m(["createProjectV2View", "updateProjectV2View", "deleteProjectV2View", "deleteProjectV2Workflow"]), out(SITE_SETUP)),
  ...all(m(["linkProjectV2ToRepository", "unlinkProjectV2FromRepository", "linkProjectV2ToTeam", "unlinkProjectV2FromTeam", "updateProjectV2Collaborators"]), out(SITE_SETUP)),

  // ---------- The Journeyman's trowel: editing a file without a terminal (levels, practice site) ----------
  ...all(m(["createRef", "createCommitOnBranch"]), gesture("The trowel: edit a file in the game, on a branch of its own, on your practice site (levels, Journeyman rank)")),
  ...all(r(["repos/create-or-update-file-contents"]), gesture("Lay the foundation stone: the first commit of an empty practice repository, the only way GitHub allows it")),

  // ---------- GraphQL: pull requests (the inspection) ----------
  ...all(m(["requestReviews", "requestReviewsByLogin"]), gesture("Send the inspector: ask someone to review a pull request")),
  ...all(m(["submitPullRequestReview", "addPullRequestReview"]), later("v2-contributors", "Stamp the inspection from inside the game; v1 opens GitHub, where the diff is read")),
  ...all(m(["addPullRequestReviewComment", "addPullRequestReviewThread", "addPullRequestReviewThreadReply", "updatePullRequestReview", "updatePullRequestReviewComment",
    "deletePullRequestReview", "deletePullRequestReviewComment", "dismissPullRequestReview", "resolveReviewThread", "unresolveReviewThread", "markFileAsViewed", "unmarkFileAsViewed", "rerequestReviews"]),
    later("v2-contributors", "Line-by-line review needs the code on screen; GitHub's own page does it better")),
  ...all(m(["mergePullRequest"]), gesture("Merge your own pull request on your practice site (levels, Journeyman rank); merging on a real project stays on GitHub with its checks and rules")),
  ...all(m(["enablePullRequestAutoMerge", "disablePullRequestAutoMerge", "enqueuePullRequest", "dequeuePullRequest", "updatePullRequestBranch"]),
    later("v2-contributors", "Merge mechanics; designed together with mergePullRequest")),
  ...all(m(["createPullRequest"]), gesture("Knock on the door: open a pull request that closes your issue, on your practice site (levels, Journeyman rank)")),
  ...all(m(["updatePullRequest", "closePullRequest", "reopenPullRequest", "convertPullRequestToDraft", "markPullRequestReadyForReview", "revertPullRequest"]),
    later("v2-contributors", "A contributor's own pull request; comes with the contributors' version")),
  ...all(m(["archivePullRequest", "unarchivePullRequest"]), out("Archiving pull requests is housekeeping, not site work")),
  ...all(m(["requestCopilotCodeReview"]), later("idea", "An AI inspector; a fun character once v1 works")),
  ...all(m(["addPullRequestCreationCapBypassUsers", "removePullRequestCreationCapBypassUsers", "updateTeamReviewAssignment"]), out("Repository administration")),

  // ---------- GraphQL: discussions (the site canteen) ----------
  ...all(m(["createDiscussion", "updateDiscussion", "addDiscussionComment", "updateDiscussionComment", "markDiscussionCommentAsAnswer", "unmarkDiscussionCommentAsAnswer",
    "closeDiscussion", "reopenDiscussion", "addUpvote", "removeUpvote", "addDiscussionPollVote"]),
    later("idea", "The canteen where the team chats; only for repositories that use Discussions")),
  ...all(m(["deleteDiscussion", "deleteDiscussionComment"]), out("Deleting what people wrote loses history")),

  // ---------- GraphQL: reactions, activity, users ----------
  ...all(m(["addReaction", "removeReaction"]), gesture("Cheer a worker: a reaction on an issue or comment")),
  ...all(m(["updateSubscription"]), gesture("Keep an eye on a pallet: subscribe to its notifications")),
  ...all(m(["addStar", "removeStar", "updateNotificationRestrictionSetting"]), out(NOT_A_BOARD_THING)),
  ...all(m(["changeUserStatus"]), later("idea", "The lead's status (\"in a meeting\") shown on their helmet")),
  ...all(m(["followUser", "unfollowUser", "createUserList", "updateUserList", "deleteUserList", "updateUserListsForItem", "setUserInteractionLimit"]), out(NOT_A_BOARD_THING)),

  // ---------- GraphQL: root queries (how the game reads the world) ----------
  ...all(q(["repository"]), read("The site: issues, sub-issues, labels, milestones, pull requests, assignees and their avatars")),
  ...all(q(["organization", "user", "repositoryOwner"]), read("The board (Projects v2): items, status, iteration, size; the members and their avatars")),
  ...all(q(["viewer"]), read("Who is playing: the lead's login and avatar")),
  ...all(q(["node", "nodes"]), read("Refresh one pallet or a handful after a gesture, by id")),
  ...all(q(["search"]), read("Find pallets across the site (the search bar at the site office)")),
  ...all(q(["rateLimit"]), read("The API budget left, shown discreetly so the game never runs dry")),
  ...all(q(["meta", "relay", "id", "resource"]), out("Technical root fields the game does not need")),
  ...all(q(["codeOfConduct", "codesOfConduct", "license", "licenses", "topic", "securityAdvisory", "securityAdvisories", "securityVulnerabilities"]), out(NOT_A_BOARD_THING)),
  ...all(q(["enterprise", "enterpriseAdministratorInvitation", "enterpriseAdministratorInvitationByToken", "enterpriseMemberInvitation", "enterpriseMemberInvitationByToken"]), out("Enterprise administration")),
  ...all(q(["marketplaceCategories", "marketplaceCategory", "marketplaceListing", "marketplaceListings", "sponsorables"]), out(NOT_A_BOARD_THING)),

  // ---------- REST: issues ----------
  ...all(r(["issues/create-milestone", "issues/update-milestone"]), gesture("Set up a mayor's visit: create or move a milestone (REST only; GraphQL has no milestone mutation)")),
  ...all(r(["issues/delete-milestone"]), out("Deleting a milestone unlinks every issue; done on GitHub on purpose")),
  ...all(r(["issues/list-milestones", "issues/get-milestone", "issues/list-labels-for-milestone"]), out("GraphQL repository.milestones already gives them")),
  ...all(r(["issues/list-events-for-timeline", "issues/list-events", "issues/list-events-for-repo", "issues/get-event"]),
    read("The story of a pallet (who moved it, when) and what changed since the last visit", "v1")),
  ...all(r(["issues/check-user-can-be-assigned", "issues/check-user-can-be-assigned-to-issue", "issues/list-assignees"]),
    read("Who can carry a pallet: only these workers appear when handing one over")),
  ...all(r(["issues/list-suggestions", "issues/approve-suggestion", "issues/dismiss-suggestion"]), later("idea", "REST side of GitHub's issue suggestions")),
  ...all(r(["issues/list-issue-artifacts", "issues/create-issue-artifact", "issues/get-issue-artifact", "issues/update-issue-artifact", "issues/delete-issue-artifact"]),
    later("idea", "Files attached to an issue; could appear as plans pinned on a pallet")),
  ...all(r(["issues/list-for-authenticated-user", "issues/list-for-org", "issues/list"]), out("Issues across every repository; the game plays one site")),
  ...all(r(["issues/lock", "issues/unlock"]), later("v2-contributors", "REST twin of lockLockable, designed with it")),
  ...all(r(["issues/create", "issues/get", "issues/update", "issues/list-for-repo", "issues/create-comment", "issues/get-comment", "issues/update-comment", "issues/delete-comment",
    "issues/list-comments", "issues/list-comments-for-repo", "issues/pin-comment", "issues/unpin-comment", "issues/add-assignees", "issues/remove-assignees",
    "issues/add-labels", "issues/set-labels", "issues/remove-label", "issues/remove-all-labels", "issues/list-labels-on-issue", "issues/list-labels-for-repo",
    "issues/create-label", "issues/get-label", "issues/update-label", "issues/delete-label", "issues/add-sub-issue", "issues/remove-sub-issue", "issues/reprioritize-sub-issue",
    "issues/list-sub-issues", "issues/get-parent", "issues/add-blocked-by-dependency", "issues/remove-dependency-blocked-by", "issues/list-dependencies-blocked-by",
    "issues/list-dependencies-blocking", "issues/add-relates-to", "issues/remove-relates-to", "issues/list-relates-to", "issues/add-issue-field-values",
    "issues/set-issue-field-values", "issues/delete-issue-field-value", "issues/list-issue-field-values-for-issue"]), out(REST_TWIN)),

  // ---------- REST: projects ----------
  ...all(r(["projects/list-view-items-for-org", "projects/list-view-items-for-user"]), read("The board as the team sees it in a saved view", "idea")),
  ...all(r(["projects/add-field-for-org", "projects/add-field-for-user", "projects/create-view-for-org", "projects/create-view-for-user"]), out(SITE_SETUP)),
  ...all(r(["projects/list-for-org", "projects/list-for-user", "projects/get-for-org", "projects/get-for-user", "projects/list-fields-for-org", "projects/list-fields-for-user",
    "projects/get-field-for-org", "projects/get-field-for-user", "projects/list-items-for-org", "projects/list-items-for-user", "projects/get-org-item", "projects/get-user-item",
    "projects/add-item-for-org", "projects/add-item-for-user", "projects/update-item-for-org", "projects/update-item-for-user", "projects/delete-item-for-org",
    "projects/delete-item-for-user", "projects/create-draft-item-for-org", "projects/create-draft-item-for-authenticated-user"]), out(REST_TWIN)),

  // ---------- REST: pull requests ----------
  ...all(r(["pulls/list-files", "pulls/list-commits", "pulls/check-if-merged"]), read("What a pull request brings, on the inspection board (files and commits counted)")),
  ...all(r(["pulls/merge-async", "pulls/get-merge-async-result"]), later("v2-contributors", "REST merge, designed with mergePullRequest")),
  ...all(r(["pull-request-stacks/add", "pull-request-stacks/create", "pull-request-stacks/get", "pull-request-stacks/list", "pull-request-stacks/unstack"]),
    later("idea", "Stacked pull requests; shown as stacked crates once a team uses them")),
  ...all(r(["pulls/list", "pulls/get", "pulls/create", "pulls/update", "pulls/merge", "pulls/update-branch", "pulls/list-requested-reviewers", "pulls/request-reviewers",
    "pulls/remove-requested-reviewers", "pulls/rerequest-reviewers", "pulls/request-copilot-code-review", "pulls/list-reviews", "pulls/get-review", "pulls/create-review",
    "pulls/update-review", "pulls/submit-review", "pulls/dismiss-review", "pulls/delete-pending-review", "pulls/list-comments-for-review", "pulls/list-review-comments",
    "pulls/list-review-comments-for-repo", "pulls/get-review-comment", "pulls/create-review-comment", "pulls/create-reply-for-review-comment", "pulls/update-review-comment",
    "pulls/delete-review-comment"]), out(REST_TWIN)),

  // ---------- REST: reactions ----------
  ...all(r(["reactions/create-for-issue", "reactions/create-for-issue-comment", "reactions/delete-for-issue", "reactions/delete-for-issue-comment", "reactions/list-for-issue",
    "reactions/list-for-issue-comment", "reactions/create-for-pull-request-review-comment", "reactions/delete-for-pull-request-comment",
    "reactions/list-for-pull-request-review-comment"]), out(REST_TWIN)),
  ...all(r(["reactions/create-for-commit-comment", "reactions/delete-for-commit-comment", "reactions/list-for-commit-comment", "reactions/create-for-release",
    "reactions/delete-for-release", "reactions/list-for-release"]), out("Commits and releases are not on the board")),

  // ---------- REST: activity (the site radio) ----------
  ...all(r(["activity/list-repo-events"]), read("What happened on the site since the last visit: feeds the morning radio")),
  ...all(r(["activity/list-notifications-for-authenticated-user", "activity/list-repo-notifications-for-authenticated-user", "activity/get-thread"]),
    read("The lead's mail at the site office: notifications for this repository")),
  ...all(r(["activity/mark-thread-as-read", "activity/mark-thread-as-done", "activity/mark-repo-notifications-as-read"]), gesture("Empty the site office mailbox: mark notifications read or done")),
  ...all(r(["activity/get-thread-subscription-for-authenticated-user", "activity/set-thread-subscription", "activity/delete-thread-subscription"]), out("Same effect as GraphQL updateSubscription")),
  ...all(r(["activity/mark-notifications-as-read", "activity/get-feeds", "activity/list-public-events", "activity/list-public-events-for-repo-network",
    "activity/list-public-events-for-user", "activity/list-public-org-events", "activity/list-received-events-for-user", "activity/list-received-public-events-for-user",
    "activity/list-events-for-authenticated-user", "activity/list-org-events-for-authenticated-user"]), out("Activity beyond this repository")),
  ...all(r(["activity/list-stargazers-for-repo", "activity/get-stargazer-count-for-repo", "activity/get-stargazer-history-for-repo", "activity/list-watchers-for-repo",
    "activity/get-repo-subscription", "activity/set-repo-subscription", "activity/delete-repo-subscription", "activity/list-repos-starred-by-authenticated-user",
    "activity/list-repos-starred-by-user", "activity/list-repos-watched-by-user", "activity/list-watched-repos-for-authenticated-user",
    "activity/check-repo-is-starred-by-authenticated-user", "activity/star-repo-for-authenticated-user", "activity/unstar-repo-for-authenticated-user"]),
    later("idea", "Stars and watchers: passers-by at the site fence, a decoration")),

  // ---------- REST: search, rate limit, meta, markdown ----------
  ...all(r(["search/issues-and-pull-requests", "search/labels", "search/users"]), out("GraphQL search already covers it")),
  ...all(r(["search/code", "search/commits", "search/repos", "search/topics"]), out(NOT_A_BOARD_THING)),
  ...all(r(["rate-limit/get"]), out("GraphQL rateLimit already covers it")),
  ...all(r(["meta/root", "meta/get", "meta/get-all-versions", "meta/get-octocat", "meta/get-zen"]), out("Technical endpoints; get-zen could feed a radio joke one day")),
  ...all(r(["markdown/render"]), read("Render a delivery note or comment the way GitHub shows it, inside the pallet card")),
  ...all(r(["markdown/render-raw"]), out("Same as markdown/render without repository context")),
};

/** One decision for a whole category, with its reason. */
export const CATEGORY_DECISIONS: Record<string, Decision> = {
  // GraphQL mutations outside the board
  "graphql:enterprise-admin": out("Enterprise administration"),
  "graphql:migrations": out("Repository migrations: not part of managing the board"),
  "graphql:sponsors": out("GitHub Sponsors: not part of managing the board"),
  "graphql:copilot": later("idea", "Copilot agents could become robot workers on the site"),
  "graphql:projects-classic": out("Projects (classic) are retired; the game works with Projects v2"),
  "graphql:repos": out("Repository settings and rules: administration, done on GitHub"),
  "graphql:orgs": out("Organisation administration"),
  "graphql:teams": out("Team administration: not part of managing the board"),
  "graphql:deployments": later("idea", "A deployment could be the ribbon-cutting of a finished building"),
  "graphql:checks": out("Writing check runs is for CI apps; the game only reads CI results through the pull request"),
  "graphql:branches": out("Branch protection and merges: administration"),
  "graphql:git": out("Low-level git refs: not part of managing the board"),
  "graphql:commits": out("Committing files is a developer's job, not a site gesture"),
  "graphql:packages": out("Packages: not part of managing the board"),
  "graphql:dependabot": out("Dependency updates: not part of managing the board"),
  // REST, outside the board
  "rest:repos": out("Repository content, settings, releases, webhooks and rules: administration or code, not the board"),
  "rest:orgs": out("Organisation administration (members are read through GraphQL)"),
  "rest:users": out("User accounts and keys (avatars are read through GraphQL)"),
  "rest:teams": out("Team administration: not part of managing the board"),
  "rest:actions": later("idea", "CI runs could be machines working on the site; read-only, once v1 works"),
  "rest:checks": out("CI details; the pull request's status rollup in GraphQL is enough"),
  "rest:apps": later("v2-contributors", "The GitHub App for the hosted version is set up here, not called during play"),
  "rest:codespaces": out("Cloud development environments"),
  "rest:copilot": later("idea", "Copilot agents as robot workers"),
  "rest:copilot-spaces": out("Copilot Spaces: not part of managing the board"),
  "rest:agents": later("idea", "Coding agents as robot workers"),
  "rest:agent-tasks": later("idea", "Coding agents as robot workers"),
  "rest:agent-automations": later("idea", "Coding agents as robot workers"),
  "rest:agent-merge": out("Agent merges: merge mechanics stay on GitHub"),
  "rest:billing": out("Billing: not part of managing the board"),
  "rest:campaigns": out("Security campaigns: not part of managing the board"),
  "rest:classroom": out("GitHub Classroom: not part of managing the board"),
  "rest:code-quality": out("Code quality: not part of managing the board"),
  "rest:code-scanning": out("Security scanning: not part of managing the board"),
  "rest:code-security": out("Security configuration: not part of managing the board"),
  "rest:secret-scanning": out("Security scanning: not part of managing the board"),
  "rest:security-advisories": out("Security advisories: not part of managing the board"),
  "rest:dependabot": out("Dependency updates: not part of managing the board"),
  "rest:dependency-graph": out("Dependency graph: not part of managing the board"),
  "rest:codes-of-conduct": out(NOT_A_BOARD_THING),
  "rest:licenses": out(NOT_A_BOARD_THING),
  "rest:gitignore": out(NOT_A_BOARD_THING),
  "rest:emojis": later("idea", "The emoji list, for reactions with GitHub's own emojis"),
  "rest:credentials": out("Credential revocation: not part of managing the board"),
  "rest:gists": out("Gists: not part of managing the board"),
  "rest:git": out("Low-level git objects: not part of managing the board"),
  "rest:hosted-compute": out("Hosted compute networking"),
  "rest:interactions": later("v2-contributors", "Interaction limits: moderation, designed with lockLockable"),
  "rest:migrations": out("Migrations: not part of managing the board"),
  "rest:oidc": out("OIDC for Actions: not part of managing the board"),
  "rest:packages": out("Packages: not part of managing the board"),
  "rest:private-registries": out("Private registries: not part of managing the board"),
  // Webhooks: v1 reads by polling; live updates come with v3
  ...Object.fromEntries(["issues", "issue", "pull", "project", "projects", "label", "milestone", "sub", "member", "membership", "discussion", "ping", "meta"]
    .map((c) => [`webhook:${c}`, later("v3-live", "Live updates: GitHub tells the site the moment something changes, instead of the game asking")])),
  ...Object.fromEntries(["branch", "check", "code", "commit", "create", "custom", "delete", "dependabot", "deploy", "deployment", "fork", "github", "gollum", "installation",
    "marketplace", "merge", "org", "organization", "package", "page", "personal", "public", "push", "registry", "release", "repository", "secret", "security",
    "sponsorship", "star", "status", "team", "watch", "workflow"]
    .map((c) => [`webhook:${c}`, out("Events outside the board")])),
};
