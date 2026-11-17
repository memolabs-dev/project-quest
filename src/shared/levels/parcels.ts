// The lead's team site: its five zones, its sizes, and the mayor's six parcels. Everything here is FICTIF and
// written by the player through the game; nothing passes for a real person (lead's path spec, section 4).

export const ZONES = ["Backlog", "Ready", "In progress", "In review", "Done"] as const;
export const SIZES = ["XS", "S", "M", "L", "XL"] as const;

/** Every text the fictitious team writes says so. */
export const PRACTICE_LINE = "Written by project-quest for practice.";

export interface Parcel {
  key: string;
  title: string;
  text: string;
  /** The parcel this one repeats: the lead closes it as a duplicate. */
  duplicateOf?: string;
}

export const PARCELS: Parcel[] = [
  { key: "hinge", title: "FICTIF The gate's hinge squeaks", text: "The mayor says: the gate squeaks every time it opens. The neighbours complain." },
  { key: "bench", title: "FICTIF A bench by the fountain", text: "The mayor says: people want to sit by the fountain. One wooden bench, facing the square." },
  { key: "square", title: "FICTIF Rebuild the whole town square", text: "The mayor says: new paving, new lights, new trees, a stage for concerts, and a market on Sundays." },
  { key: "nicer", title: "FICTIF Make it nicer", text: "The mayor says: it should look nicer. You know what I mean." },
  { key: "lights", title: "FICTIF Something about the lights", text: "The mayor says: the lights. Something about them." },
  { key: "bench-again", title: "FICTIF A bench near the fountain", text: "The mayor says: could we have a bench near the fountain? People would love to sit there.", duplicateOf: "bench" },
];

/** The hidden marker that tells the game which parcel an issue is, whatever its title becomes. */
export const parcelMarker = (key: string) => `<!-- project-quest: mayor's parcel ${key} -->`;

export const parcelBody = (p: Parcel) => `${p.text}\n\n${PRACTICE_LINE}\n${parcelMarker(p.key)}`;

/** Which parcel an issue is, from its body's marker. */
export function parcelOf(body: string | undefined): Parcel | null {
  const key = /<!-- project-quest: mayor's parcel ([\w-]+) -->/.exec(body ?? "")?.[1];
  return PARCELS.find((p) => p.key === key) ?? null;
}
