// The site's sounds (Kenney, CC0: public/audio/LICENSES.md). Browsers allow sound only after a gesture: nothing plays
// before unlock(), which the first key or pointer press calls. Each sound is held back if asked again within 60 ms.
import type { SoundName } from "./moments/list.ts";

/** The part of a Howl the game uses: a stand-in in the tests, Howler in the browser. */
export interface HowlLike {
  play(): unknown;
  volume(v: number): unknown;
  rate(r: number): unknown;
}

const FILES: Record<SoundName, string[]> = {
  thud: ["thud"], land: ["land"], chime: ["chime"], stamp: ["stamp"], rustle: ["rustle"], bonk: ["bonk"], poof: ["poof"],
  creak: ["creak"], step: ["step1", "step2", "step3", "step4"],
};
const HOLD_MS = 60;

export function createSound(make: (src: string) => HowlLike, now: () => number = () => performance.now()) {
  const howls = new Map<string, HowlLike>();
  const last = new Map<SoundName, number>();
  const steps = new Map<SoundName, number>();
  let unlocked = false;
  let muted = false;
  let volume = 1;
  const howl = (file: string) => {
    let h = howls.get(file);
    if (!h) {
      h = make(`/audio/${file}.ogg`);
      howls.set(file, h);
    }
    return h;
  };
  return {
    play(name: SoundName, opts: { rate?: number } = {}) {
      if (!unlocked || muted) return;
      const t = now();
      if (t - (last.get(name) ?? -Infinity) < HOLD_MS) return;
      last.set(name, t);
      // Several files for one sound (footsteps) take turns, so they never sound like a loop.
      const files = FILES[name];
      const i = (steps.get(name) ?? 0) % files.length;
      steps.set(name, i + 1);
      const h = howl(files[i]);
      h.volume(volume);
      h.rate(opts.rate ?? 1);
      h.play();
    },
    setVolume(v: number) { volume = Math.min(1, Math.max(0, v)); },
    setMuted(m: boolean) { muted = m; },
    unlock() { unlocked = true; },
  };
}

export type Sound = ReturnType<typeof createSound>;

let shared: Sound | null = null;
/** The game's one sound player, made with Howler on first use (browser only). */
export async function gameSound(): Promise<Sound> {
  if (!shared) {
    const { Howl } = await import("howler");
    shared = createSound((src) => new Howl({ src: [src], preload: true }));
  }
  return shared;
}
