// Every level, in the order they are played.
import { APPRENTICE } from "./apprentice.ts";
import { JOURNEYMAN } from "./journeyman.ts";
import { TEAM_LEADER } from "./team-leader.ts";

export const LEVELS = [...APPRENTICE, ...JOURNEYMAN, ...TEAM_LEADER];
