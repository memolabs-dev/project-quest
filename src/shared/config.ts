// The board the game plays: owner, repository, project, field names and zone order.
// Read from quest.config.json; nothing else in the code names a project.
import { z } from "zod";

const schema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  projectNumber: z.number().int().positive(),
  fields: z.object({ status: z.string().min(1), iteration: z.string().min(1), size: z.string().min(1) }),
  /** Board status options, in the order the site lays out its zones; the last one is "done". */
  zones: z.array(z.string().min(1)).min(2),
  labels: z.object({
    bug: z.array(z.string()),
    /** label -> trade of the worker (mason, painter...) */
    trades: z.record(z.string(), z.string()),
    /** Labels that mark an issue for newcomers (levels, real project). */
    goodFirst: z.array(z.string().min(1)).default(["good first issue"]),
  }),
});

export type QuestConfig = z.infer<typeof schema>;

export class ConfigError extends Error {}

export function loadConfig(json: unknown): QuestConfig {
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const where = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new ConfigError(`quest.config.json is invalid: ${where}`);
  }
  return parsed.data;
}
