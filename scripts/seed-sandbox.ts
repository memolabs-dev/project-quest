// Fills the sandbox repository and its board with the invented site of the demo (src/shared/demo/demo-board.json):
// epics with their sub-issues, labels, board columns, closed issues. Only ever targets the sandbox named below.
// Safe to re-run: issues that already exist (same title) are reused. Run: npx tsx scripts/seed-sandbox.ts
import { readFileSync } from "node:fs";
import { githubGql } from "../src/server/github/client.ts";
import type { BoardSnapshot } from "../src/shared/site.ts";

const OWNER = "memolabs-dev";
const REPO = "project-quest-sandbox";
const PROJECT = 10;
if (!REPO.endsWith("-sandbox")) throw new Error("This script only seeds a sandbox repository");

const demo = JSON.parse(readFileSync(new URL("../src/shared/demo/demo-board.json", import.meta.url), "utf8")) as BoardSnapshot;
const gql = await githubGql();
const LABEL_COLORS: Record<string, string> = { bug: "d73a4a", back: "6f42c1", front: "0e8a16", data: "1d76db", design: "fbca04" };

type Repo = { id: string; labels: { nodes: { id: string; name: string }[] }; issues: { nodes: { id: string; number: number; title: string; state: string }[] } };
const repoQuery = async () => (await gql<{ repository: Repo }>(`query($o:String!,$r:String!){ repository(owner:$o,name:$r){ id
  labels(first:50){ nodes{ id name } } issues(first:100, states:[OPEN,CLOSED]){ nodes{ id number title state } } } }`, { o: OWNER, r: REPO })).repository;

let repo = await repoQuery();
for (const [name, color] of Object.entries(LABEL_COLORS)) {
  if (!repo.labels.nodes.some((l) => l.name === name)) {
    await gql(`mutation($id:ID!,$n:String!,$c:String!){ createLabel(input:{repositoryId:$id,name:$n,color:$c}){ label{ id } } }`, { id: repo.id, n: name, c: color });
  }
}
repo = await repoQuery();
const labelId = (n: string) => repo.labels.nodes.find((l) => l.name === n)?.id;

const project = (await gql<{ organization: { projectV2: { id: string; field: { id: string; options: { id: string; name: string }[] } } } }>(
  `query($o:String!,$n:Int!){ organization(login:$o){ projectV2(number:$n){ id field(name:"Status"){ ... on ProjectV2SingleSelectField { id options{ id name } } } } } }`,
  { o: OWNER, n: PROJECT })).organization.projectV2;

const ids = new Map<number, string>(); // demo number -> sandbox issue node id
for (const item of demo.items) {
  const title = item.title.startsWith("FICTIF") ? item.title : `FICTIF ${item.title}`;
  let issue = repo.issues.nodes.find((i) => i.title === title);
  if (!issue) {
    const body = "Invented issue (FICTIF) for testing project-quest. Nothing here is real.";
    const r = await gql<{ createIssue: { issue: { id: string; number: number; title: string; state: string } } }>(
      `mutation($id:ID!,$t:String!,$b:String!,$l:[ID!]){ createIssue(input:{repositoryId:$id,title:$t,body:$b,labelIds:$l}){ issue{ id number title state } } }`,
      { id: repo.id, t: title, b: body, l: item.labels.map(labelId).filter(Boolean) });
    issue = r.createIssue.issue;
    console.log(`created #${issue.number} ${title}`);
  }
  ids.set(item.number, issue.id);
}

for (const item of demo.items) {
  const id = ids.get(item.number)!;
  if (item.parent) {
    await gql(`mutation($p:ID!,$c:ID!){ addSubIssue(input:{issueId:$p,subIssueId:$c}){ issue{ id } } }`, { p: ids.get(item.parent), c: id })
      .catch(() => undefined); // already linked
  }
  const added = await gql<{ addProjectV2ItemById: { item: { id: string } } }>(
    `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`, { p: project.id, c: id });
  const option = project.field.options.find((o) => o.name === item.status);
  if (option) {
    await gql(`mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }`,
      { p: project.id, i: added.addProjectV2ItemById.item.id, f: project.field.id, o: option.id });
  }
  if (item.state === "CLOSED") {
    await gql(`mutation($i:ID!){ closeIssue(input:{issueId:$i, stateReason:COMPLETED}){ issue{ id } } }`, { i: id }).catch(() => undefined);
  }
}
console.log(`sandbox seeded: ${demo.items.length} issues on project ${PROJECT}`);
