// The visit's photo, its pure part (#16): the drawing itself lives in ui/Visit.tsx, where the browser is.

/** A file name safe on every system: project-quest-owner-name.png. */
export const photoName = (repo: string) => `project-quest-${repo.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}.png`;

/** The caption band's height for a picture of this height: readable, never more than a tenth of it. */
export const bandHeight = (height: number) => Math.max(36, Math.round(height / 10));
