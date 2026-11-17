// The camera kick in flight, shared by the director (which starts it) and the follow camera (which adds it). Mutated
// every frame, outside React on purpose.
export const cameraKick = { started: -Infinity, strength: 0 };
