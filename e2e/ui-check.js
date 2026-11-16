// ui-check: measured UI sweep, run in the browser on the served app (same origin).
// Paste into the console, or pass to a browser tool's JavaScript runner, then call:
//   await uiCheck({ pages: ['/', '/patients.html'] })
// Options: widths (default 375, 768, 1024, 1440), themes (default light, dark), settle (ms, default 1200).
// Each page loads in a hidden iframe at each width and theme; animations are finished before measuring.
//
// Touch sizing (targets >= 44 px, inputs >= 16 px) is only meaningful when the browser reports a coarse pointer,
// because responsive CSS keys on (pointer: coarse). Run once in mobile emulation for those two counts; on a
// desktop pointer they are reported as "skipped". Console errors are not captured here: read the console.
//
// Blind spots: contrast ignores placeholders, input values, <pre> text and [disabled] controls, skips backgrounds
// at alpha <= 0.5, and assumes black when every ancestor is transparent. Overflow narrower than a classic
// scrollbar is missed. Accessibility semantics (names, focus, ARIA) are not measured at all.

async function uiCheck({ pages = [location.pathname + location.search], widths = [375, 768, 1024, 1440], themes = ['light', 'dark'], settle = 1200 } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const results = [];

  for (const theme of themes) {
    for (const width of widths) {
      for (const page of pages) {
        const frame = document.createElement('iframe');
        frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:900px;opacity:0;pointer-events:none;border:0`;
        frame.src = page;
        document.body.append(frame);
        await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
        const doc = frame.contentDocument;
        // Theme: Bootstrap uses data-bs-theme; many apps use data-theme or color-scheme.
        doc.documentElement.setAttribute('data-bs-theme', theme);
        doc.documentElement.setAttribute('data-theme', theme);
        doc.documentElement.style.colorScheme = theme;
        await new Promise((resolve) => setTimeout(resolve, settle));
        doc.getAnimations().forEach((a) => { try { a.finish(); } catch { a.cancel(); } });
        results.push({ page, width, theme, ...measure(doc, width, coarse) });
        frame.remove();
      }
    }
  }

  const totals = results.reduce((t, r) => {
    t.overflow += r.overflowX > 0 ? 1 : 0;
    t.contrast += r.contrast.length;
    t.targets += r.targets === 'skipped' ? 0 : r.targets.length;
    t.inputs += r.inputs === 'skipped' ? 0 : r.inputs.length;
    return t;
  }, { overflow: 0, contrast: 0, targets: 0, inputs: 0 });

  return { coarsePointer: coarse, totals, failures: results.filter((r) => r.overflowX > 0 || r.contrast.length || (Array.isArray(r.targets) && r.targets.length) || (Array.isArray(r.inputs) && r.inputs.length)) };
}

function measure(doc, width, coarse) {
  const win = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (colour) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = colour; // converts oklch(), color-mix() results and named colours to sRGB
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const luminance = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const background = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(win.getComputedStyle(e).backgroundColor);
      if (c[3] > 0.5) return c;
    }
    return rgba(win.getComputedStyle(doc.body).backgroundColor);
  };
  const hidden = '[aria-hidden="true"], .visually-hidden, .visually-hidden-focusable, .sr-only, dialog:not([open]), [hidden], pre, [disabled], .disabled';
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = win.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest(hidden);
  };
  const label = (el) => `${(el.className || el.tagName).toString().split(' ').slice(0, 2).join('.')}`;

  // Contrast: every visible text node against its first opaque ancestor background (WCAG 2.x, AA).
  const contrast = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement;
    if (!node.textContent.trim() || !el || !visible(el)) continue;
    const cs = win.getComputedStyle(el);
    const fg = rgba(cs.color);
    const bg = background(el);
    const mixed = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const [hi, lo] = [luminance(mixed), luminance(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (parseInt(cs.fontWeight, 10) >= 700 && size >= 18.66);
    if (ratio < (large ? 3 : 4.5)) contrast.push(`${label(el)} "${node.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
  }

  let targets = 'skipped';
  let inputs = 'skipped';
  if (coarse) {
    // A field wrapped in a clickable <label> (input adornments) counts through its label.
    targets = [...doc.querySelectorAll('a[href], button, select, textarea, input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=range]), [role=button]')]
      .filter(visible)
      .filter((el) => !el.closest('label.form-adorn, .menu:not(.show)'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
      .map((el) => { const r = el.getBoundingClientRect(); return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
    inputs = [...doc.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=range]):not([type=hidden]), select, textarea')]
      .filter(visible)
      .filter((el) => parseFloat(win.getComputedStyle(el).fontSize) < 16)
      .map((el) => `${label(el)} ${win.getComputedStyle(el).fontSize}`);
  }

  return {
    overflowX: doc.documentElement.scrollWidth - width,
    contrast: [...new Set(contrast)].slice(0, 15),
    targets: Array.isArray(targets) ? [...new Set(targets)].slice(0, 15) : targets,
    inputs: Array.isArray(inputs) ? [...new Set(inputs)].slice(0, 15) : inputs,
  };
}
