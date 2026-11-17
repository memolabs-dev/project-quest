// Movement follows the physical keys (event.code), so the four keys sit in the same place under the
// fingers on any layout: WASD on QWERTY, ZQSD on AZERTY, and so on. The hint shows the player's own
// letters when the browser can tell (Keyboard Map API, Chromium); otherwise it shows QWERTY letters.
export const KEY_MAP = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

export const MOVE_CODES = ["KeyW", "KeyA", "KeyS", "KeyD"] as const;
export const ACTION_CODE = "KeyE";
/** Cheer the worker within reach. */
export const CHEER_CODE = "KeyR";

type LayoutMap = { get(code: string): string | undefined };
type KeyboardApi = { getLayoutMap(): Promise<LayoutMap> };

const QWERTY: Record<string, string> = { KeyW: "W", KeyA: "A", KeyS: "S", KeyD: "D", KeyE: "E", KeyR: "R" };

/** The letters printed on the player's keys for the given physical codes. */
export async function keyLetters(codes: readonly string[]): Promise<string[]> {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardApi }).keyboard;
  let map: LayoutMap | null = null;
  try {
    map = keyboard ? await keyboard.getLayoutMap() : null;
  } catch {
    map = null;
  }
  return codes.map((c) => (map?.get(c) ?? QWERTY[c] ?? c).toUpperCase());
}
