// Textures drawn in code (no image or font to download): the site ground and painted numbers.
import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Seeded random, so the ground looks the same on every visit. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Packed earth with gravel and a few tyre tracks; tiled across the site. */
export function groundTexture() {
  const t = canvasTexture("ground", 512, 512, (ctx) => {
    const r = rng(7);
    ctx.fillStyle = "#D9B98A";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const shade = 150 + Math.floor(r() * 70);
      ctx.fillStyle = `rgba(${shade + 40},${shade + 10},${shade - 40},${0.18 + r() * 0.3})`;
      const s = 1 + r() * 3.5;
      ctx.fillRect(r() * 512, r() * 512, s, s);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(120,90,60,${0.05 + r() * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(r() * 512, r() * 512, 20 + r() * 50, 8 + r() * 26, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(110,80,50,0.16)";
    ctx.lineWidth = 9;
    ctx.setLineDash([6, 5]);
    for (const y of [150, 172, 372, 394]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + 30, 340, y - 30, 512, y);
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A number painted in white, as on the ground of a yard or the side of a crate. */
export function paintedNumber(text: string, ink = "#FFFFFF", background: string | null = null) {
  return canvasTexture(`num:${text}:${ink}:${background}`, 256, 128, (ctx) => {
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 256, 128);
    }
    ctx.fillStyle = ink;
    ctx.font = "900 96px 'Trebuchet MS', 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 70, 240);
  });
}
