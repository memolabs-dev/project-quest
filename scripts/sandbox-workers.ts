// Gives the sandbox two workers to cheer: assigns the account running it (the owner, who asks for these issues
// himself) to two open FICTIF issues that have no assignee. Never anyone else, never a real project.
// Run: npx tsx scripts/sandbox-workers.ts            (shows what it would do)
//      npx tsx scripts/sandbox-workers.ts --apply    (does it)
import { githubGql } from "../src/server/github/client.ts";

const OWNER = "memolabs-dev";
const REPO = "project-quest-sandbox";
const TITLES = ["FICTIF Paint the facade", "FICTIF Termites in the attic"];
if (!REPO.endsWith("-sandbox")) throw new Error("This script only touches a sandbox repository");

const apply = process.argv.includes("--apply");
const gql = await githubGql();
const { viewer } = await gql<{ viewer: { id: string; login: string } }>("query { viewer { id login } }", {});
const { repository } = await gql<{ repository: { issues: { nodes: { id: string; number: number; title: string; assignees: { totalCount: number } }[] } } }>(
  `query($o:String!,$r:String!){ repository(owner:$o,name:$r){ issues(first:100, states:[OPEN]){ nodes{ id number title assignees{ totalCount } } } } }`,
  { o: OWNER, r: REPO });
for (const title of TITLES) {
  const issue = repository.issues.nodes.find((i) => i.title === title);
  if (!issue) { console.log(`skip: "${title}" is not open on ${OWNER}/${REPO}`); continue; }
  if (issue.assignees.totalCount > 0) { console.log(`skip: #${issue.number} already has someone`); continue; }
  console.log(`${apply ? "assigning" : "would assign"} ${viewer.login} to #${issue.number} ${title}`);
  if (apply) {
    await gql(`mutation($a:ID!,$u:[ID!]!){ addAssigneesToAssignable(input:{assignableId:$a,assigneeIds:$u}){ clientMutationId } }`,
      { a: issue.id, u: [viewer.id] });
  }
}
