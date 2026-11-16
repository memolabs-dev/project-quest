/** Colours of the board's columns, in order; the last zone is "done". Reused cyclically for longer boards. */
export const ZONE_COLORS = ["#9AA0A6", "#3E9B5F", "#F08A24", "#3D6FD1", "#1B2747"];
export const zoneColor = (index: number) => ZONE_COLORS[index % ZONE_COLORS.length];
