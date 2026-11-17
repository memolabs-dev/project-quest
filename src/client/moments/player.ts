// Where the foreman stands, and when the player last pressed something: written by the Player each frame, read by the
// workers (who look and wave) and the foreman (who rests). Mutated outside React on purpose, like the camera kick.
export const playerPosition = { x: 0, z: 0 };
export const lastInput = { at: typeof performance === "undefined" ? 0 : performance.now() };
