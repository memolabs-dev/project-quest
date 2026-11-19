// The moments: what answers each gesture that matters. Data only; the director plays them (living site spec, 3).
// With reduced motion a moment keeps its sound and loses its motion: no dust, no camera kick, no reaction. The words
// that stand in for the motion live where the motion was (the building's board says "New floor laid").

export type SoundName = "thud" | "land" | "chime" | "stamp" | "rustle" | "bonk" | "poof" | "step" | "creak" | "cheer" | "radio";
export type MomentKind =
  | "pallet-moved" | "floor-laid" | "parcel" | "cleared" | "stamp" | "refused" | "card-open" | "card-close" | "loaded" | "overloaded"
  /** A warm gesture GitHub accepted: the worker answers, the foreman raises a hand (people of the site, 7). */
  | "cheered" | "thanked"
  /** A talk GitHub accepted: the person waves back (welcome and answer spec, 5). */
  | "talked";

export interface MomentSpec {
  sound: SoundName | null;
  dust: "puff" | "ring" | null;
  /** The camera kick's strength, in metres; 0 for none. */
  kick: number;
  /** How the foreman answers: the one big moment cheers. */
  react: "cheer" | "lean" | null;
  /** The sound and the dust wait for the crate to touch the ground (the pallet announces its landing). */
  onLanding?: boolean;
}

const quiet = (sound: SoundName | null, o: Partial<MomentSpec> = {}): MomentSpec => ({
  sound, dust: null, kick: 0, react: null, ...o,
});

export const MOMENTS: Record<MomentKind, MomentSpec> = {
  "pallet-moved": quiet("land", { dust: "puff", onLanding: true }),
  "floor-laid": { sound: "chime", dust: "ring", kick: 0.12, react: "cheer" },
  parcel: quiet("thud", { dust: "puff", onLanding: true }),
  cleared: quiet("poof", { dust: "puff" }),
  stamp: quiet("stamp"),
  refused: quiet("bonk"),
  "card-open": quiet("rustle", { react: "lean" }),
  "card-close": quiet("rustle"),
  // A copy of the crate hops onto the sprint truck: the thud (or the creak) when it lands on the bed (spec 3.2).
  loaded: quiet("thud", { dust: "puff", onLanding: true }),
  overloaded: quiet("creak", { dust: "puff", onLanding: true }),
  cheered: quiet("cheer", { react: "lean" }),
  thanked: quiet("cheer", { react: "lean" }),
  talked: quiet("cheer", { react: "lean" }),
};
