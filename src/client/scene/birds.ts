// A small flock now and then (living site spec, section 5): every 45 to 75 seconds, seven birds cross the sky in a
// loose V for 14 seconds, between the yards and the buildings, just above the scaffolds: the follow camera looks
// down at the site and never sees the sky, so that is where a flock shows. Pure: the scene draws them instanced.
export const FLOCK = 7;
const CROSSING = 14;
const SPAN = 40;

const rand = (seed: number, n: number) => {
  const x = Math.sin((seed * 9973 + n * 7919) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** The birds at `seconds`, or null between crossings. `flap` (-1 to 1) beats the wings. */
export function flockAt(seconds: number, seed: number): { x: number; y: number; z: number; flap: number }[] | null {
  let start = 0;
  for (let k = 0; ; k++) {
    start += 45 + 30 * rand(seed, k);
    if (seconds < start) return null;
    if (seconds < start + CROSSING) {
      const p = (seconds - start) / CROSSING;
      const way = k % 2 ? -1 : 1;
      const lead = way * (-SPAN + 2 * SPAN * p);
      const height = 5 + 0.6 * rand(seed, k + 500);
      // The V spreads 2.4 m each way: its rear stays in front of the buildings (z -18), whatever their height.
      const z = -14.5 + 1 * rand(seed, k + 900);
      return Array.from({ length: FLOCK }, (_, i) => {
        const row = Math.ceil(i / 2);
        const side = i % 2 ? 1 : -1;
        return {
          x: lead - way * row * 1.2,
          y: height + row * 0.15 + Math.sin(seconds * 1.3 + i) * 0.15,
          z: z + side * row * 0.8,
          flap: Math.sin(seconds * 12 + i * 1.7),
        };
      });
    }
  }
}
