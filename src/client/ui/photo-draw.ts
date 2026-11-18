// The visit's photo (#16, #17): the site's canvas, then its HTML labels drawn back at their place on screen
// (zone signs, building labels, workers' badges and names), then the caption band.
import { bandHeight, wrapLines } from "../photo.ts";

const INK = "#1c1c1c";
const PAPER = "#fffaf0";
const ACCENT = "#f08a24";
/** The labels laid over the 3D scene; anything else over the canvas (banner, buttons) stays out of the picture. */
const LABELS = ".sign-label, .building-label, .worker-name, .near-tag";

type Box = { x: number; y: number; w: number; h: number };

/** An avatar from GitHub, loaded for drawing (GitHub's avatar host allows it), or null if it cannot be. */
const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** Each piece of text inside a label, with the screen box it occupies and the font it is drawn in. */
function textPieces(label: Element): { text: string; rect: DOMRect; font: string; color: string }[] {
  const pieces: { text: string; rect: DOMRect; font: string; color: string }[] = [];
  const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? "").trim();
    const parent = n.parentElement;
    if (!text || !parent) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const s = getComputedStyle(parent);
    pieces.push({ text, rect: range.getBoundingClientRect(), font: `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, color: s.color });
  }
  return pieces;
}

function roundBox(g: CanvasRenderingContext2D, b: Box, radius: number) {
  g.beginPath();
  g.roundRect(b.x, b.y, b.w, b.h, radius);
}

/** Draws the site's canvas with its labels and a caption band, and returns the picture as a PNG data address.
 * The site canvas keeps its last frame on a visit (preserveDrawingBuffer), or the picture would come out empty. */
export async function sitePhoto(site: HTMLCanvasElement, repo: string, signature: string): Promise<string> {
  const band = bandHeight(site.height);
  const out = document.createElement("canvas");
  out.width = site.width;
  out.height = site.height + band;
  const g = out.getContext("2d");
  if (!g) throw new Error("No 2D drawing in this browser");
  g.drawImage(site, 0, 0);

  // Screen pixels to picture pixels.
  const frame = site.getBoundingClientRect();
  const k = site.width / frame.width;
  const toPhoto = (r: DOMRect): Box => ({ x: (r.left - frame.left) * k, y: (r.top - frame.top) * k, w: r.width * k, h: r.height * k });
  const inside = (b: Box) => b.w > 0 && b.h > 0 && b.x + b.w > 0 && b.y + b.h > 0 && b.x < site.width && b.y < site.height;

  for (const label of document.querySelectorAll(LABELS)) {
    const s = getComputedStyle(label);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;
    const rect = label.getBoundingClientRect();
    const b = toPhoto(rect);
    if (!inside(b)) continue;
    // Labels in the scene are scaled by a CSS transform (their distance): fonts and borders shrink with them,
    // while the computed sizes do not. offsetWidth is the label's width before the transform.
    const own = (label as HTMLElement).offsetWidth;
    const scale = own > 0 ? rect.width / own : 1;
    const ks = k * scale;
    roundBox(g, b, 6 * ks);
    g.fillStyle = s.backgroundColor === "rgba(0, 0, 0, 0)" ? PAPER : s.backgroundColor;
    g.fill();
    g.lineWidth = 2.5 * ks;
    g.strokeStyle = INK;
    g.stroke();
    // The zone's colour on the sign's top edge, as on screen.
    const top = parseFloat(s.borderTopWidth) * ks;
    if (top > 3 * ks) {
      g.fillStyle = s.borderTopColor;
      g.fillRect(b.x + 1.25 * ks, b.y + 1.25 * ks, b.w - 2.5 * ks, top - 1.25 * ks);
    }
    for (const p of textPieces(label)) {
      const box = toPhoto(p.rect);
      // The font as on screen, at the picture's scale (font sizes are in CSS pixels).
      g.font = p.font.replace(/(\d+(?:\.\d+)?)px/, (_, px: string) => `${Number(px) * ks}px`);
      g.fillStyle = p.color;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const lines = wrapLines(p.text, box.w + 2 * ks, (t) => g.measureText(t).width);
      const lineH = box.h / lines.length;
      lines.forEach((line, i) => g.fillText(line, box.x + box.w / 2, box.y + lineH * (i + 0.5)));
    }
  }

  // Workers' badges: a ring in their colour, their GitHub avatar inside, or their initial.
  for (const badge of document.querySelectorAll<HTMLElement>(".worker-badge")) {
    const b = toPhoto(badge.getBoundingClientRect());
    if (!inside(b)) continue;
    const r = Math.min(b.w, b.h) / 2;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const img = badge.querySelector("img");
    const avatar = img ? await loadImage(img.src) : null;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = PAPER;
    g.fill();
    if (avatar) {
      g.clip();
      g.drawImage(avatar, cx - r, cy - r, 2 * r, 2 * r);
    } else {
      g.fillStyle = INK;
      g.font = `900 ${r}px Nunito, system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(badge.textContent?.trim() || img?.alt?.[0]?.toUpperCase() || "?", cx, cy);
    }
    g.restore();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.lineWidth = 3 * k;
    g.strokeStyle = getComputedStyle(badge).borderTopColor;
    g.stroke();
  }

  // The caption band: the repository and the game's name.
  g.fillStyle = INK;
  g.fillRect(0, site.height, out.width, band);
  const pad = Math.round(band * 0.4);
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillStyle = PAPER;
  g.font = `800 ${Math.round(band * 0.45)}px Nunito, system-ui, sans-serif`;
  g.fillText(repo, pad, site.height + band / 2);
  g.textAlign = "right";
  g.fillStyle = ACCENT;
  g.font = `700 ${Math.round(band * 0.32)}px Nunito, system-ui, sans-serif`;
  g.fillText(signature, out.width - pad, site.height + band / 2);
  return out.toDataURL("image/png");
}
