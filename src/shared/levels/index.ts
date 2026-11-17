// Every level, in the order they are played.
import { APPRENTICE } from "./apprentice.ts";
import { JOURNEYMAN } from "./journeyman.ts";
import { SITE_FOREMAN, SITE_MANAGER } from "./lead.ts";
import { REAL_PROJECT } from "./real-project.ts";
import { TEAM_LEADER } from "./team-leader.ts";

import type { Level, Path } from "./types.ts";

export const VOLUNTEER = [...APPRENTICE, ...JOURNEYMAN, ...TEAM_LEADER, ...REAL_PROJECT];
export const LEAD: Level[] = [...SITE_FOREMAN, ...SITE_MANAGER];
export const LEVELS = [...VOLUNTEER, ...LEAD];

/** One path's levels, in the order they are played. */
export const levelsOf = (path: Path, levels: Level[] = LEVELS) => levels.filter((l) => l.path === path);
