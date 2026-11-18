// The visit's photo, its pure part (#16): the drawing itself lives in ui/Visit.tsx, where the browser is.

/** A file name safe on every system: project-quest-owner-name.png. */
export const photoName = (repo: string) => `project-quest-${repo.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}.png`;

/** The caption band's height for a picture of this height: readable, never more than a tenth of it. */
export const bandHeight = (height: number) => Math.max(36, Math.round(height / 10));

/** Splits a label's text into lines no wider than `width`, as the browser wrapped it on screen; a word wider than the
 * line keeps a line of its own (the browser would have let it overflow too). */
export function wrapLines(text: string, width: number, measure: (t: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
