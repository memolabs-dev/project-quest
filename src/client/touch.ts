// Whether the screen is touched rather than pointed at (#17): a phone or a tablet.
export const isTouch = () => globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
