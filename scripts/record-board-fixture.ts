// Records the shape of a real board response for the tests, with every identifying value replaced:
// titles, logins, avatars, URLs and node ids become FICTIF values. Run: npx tsx scripts/record-board-fixture.ts
import { readFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "../src/shared/config.ts";
import { githubGql } from "../src/server/github/client.ts";
import { BOARD_QUERY } from "../src/server/github/read-board.ts";

const config = loadConfig(JSON.parse(readFileSync(new URL("../quest.config.json", import.meta.url), "utf8")));
const gql = await githubGql();
const res = await gql<{ repositoryOwner: { projectV2: Record<string, any> } }>(BOARD_QUERY, {
  owner: config.owner, number: config.projectNumber, statusField: config.fields.status, sizeField: config.fields.size, after: null,
});

const logins = new Map<string, string>();
const fake = (login: string) => logins.get(login) ?? (logins.set(login, `fictif-user-${logins.size + 1}`), logins.get(login)!);
let id = 0;
const p = res.repositoryOwner.projectV2;
p.id = "PVT_fictif";
if (p.field) {
  p.field.id = "PVTSSF_fictif";
  p.field.options = p.field.options.map((o: { name: string }, i: number) => ({ id: `opt_${i}`, name: o.name }));
}
p.items.pageInfo = { hasNextPage: false, endCursor: null };
for (const n of p.items.nodes) {
  n.id = `PVTI_fictif_${++id}`;
  const c = n.content;
  if (c?.__typename !== "Issue") continue;
  c.id = `I_fictif_${id}`;
  c.title = `FICTIF item ${c.number}`;
  c.url = `https://github.com/fictif-org/fictif-repo/issues/${c.number}`;
  for (const a of c.assignees.nodes) { a.login = fake(a.login); a.avatarUrl = "https://example.org/avatar.png"; }
}
const out = new URL("../src/server/github/__fixtures__/board-response.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(res, null, 1)}\n`);
console.log(`recorded ${p.items.nodes.length} items`);
