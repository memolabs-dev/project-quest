// Builds docs/github-api/inventory.json: every GitHub API operation, from the two official descriptions
// downloaded into docs/github-api/ (GraphQL schema and REST OpenAPI). Run: npx tsx scripts/api-inventory.ts
//
// Sources (re-download to refresh):
//   https://docs.github.com/public/fpt/schema.docs.graphql
//   https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
import { readFileSync, writeFileSync } from "node:fs";
import { Kind, parse, type FieldDefinitionNode, type ObjectTypeDefinitionNode } from "graphql";

const dir = new URL("../docs/github-api/", import.meta.url);

export interface Operation {
  /** graphql.mutation.<name>, graphql.query.<name>, rest.<operationId>, webhook.<event> */
  id: string;
  api: "graphql" | "rest" | "webhook";
  /** the docs category (GraphQL @docsCategory, REST first tag, webhook event group) */
  category: string;
  summary: string;
}

const docsCategory = (f: FieldDefinitionNode) => {
  const d = f.directives?.find((x) => x.name.value === "docsCategory");
  const arg = d?.arguments?.find((a) => a.name.value === "name");
  return arg && arg.value.kind === Kind.STRING ? arg.value.value : "meta";
};

function graphqlOperations(): Operation[] {
  const doc = parse(readFileSync(new URL("schema.docs.graphql", dir), "utf8"));
  const root = (name: string) =>
    doc.definitions.find((d): d is ObjectTypeDefinitionNode => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === name)!;
  const ops: Operation[] = [];
  for (const [type, kind] of [["Mutation", "mutation"], ["Query", "query"]] as const) {
    for (const f of root(type).fields ?? []) {
      ops.push({
        id: `graphql.${kind}.${f.name.value}`,
        api: "graphql",
        category: docsCategory(f),
        summary: (f.description?.value ?? "").split("\n")[0].trim(),
      });
    }
  }
  return ops;
}

interface OpenApiOperation { operationId: string; tags?: string[]; summary?: string }
interface OpenApi {
  info: { version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  webhooks?: Record<string, Record<string, OpenApiOperation>>;
  "x-webhooks"?: Record<string, Record<string, OpenApiOperation>>;
}

function restOperations(): { version: string; ops: Operation[] } {
  const spec = JSON.parse(readFileSync(new URL("rest-api.json", dir), "utf8")) as OpenApi;
  const ops: Operation[] = [];
  for (const methods of Object.values(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      ops.push({ id: `rest.${op.operationId}`, api: "rest", category: op.tags?.[0] ?? "untagged", summary: op.summary ?? "" });
    }
  }
  const hooks = spec.webhooks ?? spec["x-webhooks"] ?? {};
  for (const [event, methods] of Object.entries(hooks)) {
    const op = Object.values(methods)[0];
    ops.push({ id: `webhook.${event}`, api: "webhook", category: event.split("-")[0], summary: op?.summary ?? "" });
  }
  return { version: spec.info.version, ops };
}

const rest = restOperations();
const operations = [...graphqlOperations(), ...rest.ops].sort((a, b) => a.id.localeCompare(b.id));
const counts = operations.reduce<Record<string, number>>((c, o) => ({ ...c, [o.api]: (c[o.api] ?? 0) + 1 }), {});
writeFileSync(
  new URL("inventory.json", dir),
  `${JSON.stringify({ restVersion: rest.version, generatedAt: new Date().toISOString().slice(0, 10), counts, operations }, null, 1)}\n`,
);
console.log(`inventory.json: ${operations.length} operations`, counts);
