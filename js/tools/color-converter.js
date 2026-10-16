/* Colour Converter — every model you'd paste a colour as, plus shades and contrast. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const NAMES = { "#000000": "Black", "#ffffff": "White", "#ff0000": "Red", "#00ff00": "Lime", "#0000ff": "Blue", "#ffff00": "Yellow", "#00ffff": "Aqua", "#ff00ff": "Fuchsia", "#c0c0c0": "Silver", "#808080": "Gray", "#800000": "Maroon", "#808000": "Olive", "#008000": "Green", "#800080": "Purple", "#008080": "Teal", "#000080": "Navy", "#ffa500": "Orange", "#ffc0cb": "Pink" };

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The colour" }));
  side.append(panel);
  const picker = el("input", { type: "color", value: "#2f6b4f", style: "width:100%;height:38px;padding:2px;border:1.5px solid var(--line);border-radius:8px;background:var(--paper);cursor:pointer" });
  panel.append(picker);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Accepts #hex (3, 4, 6 or 8 digits), rgb()/rgba(), hsl()/hsla() and the basic colour names. The contrast checker follows the WCAG maths — 4.5:1 is the AA bar for body text, 7:1 is AAA." }));
  side.append(note);

  const inp = el("input", { class: "input", spellcheck: "false", value: "#2f6b4f", placeholder: "#2f6b4f · rgb(47,107,79) · hsl(152,39%,30%)",
    style: "font-family:var(--mono);font-size:15px;margin-top:18px" });
  app.append(inp);

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  function parseColor(src) {
    let s = String(src).trim().toLowerCase();
    const named = Object.keys(NAMES).find(k => NAMES[k].toLowerCase() === s);
    if (named) s = named;
    let m;
    if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split("").map(c => c + c).join("");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    if ((m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s))) {
      const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a: Math.min(1, Math.max(0, a)) };
    }
    if ((m = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s))) {
      const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      const rgb = hslToRgb(+m[1] % 360, +m[2] / 100, +m[3] / 100);
      return { ...rgb, a: Math.min(1, Math.max(0, a)) };
    }
    return null;
  }
  function hslToRgb(h, s, l) {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return { r: f(0), g: f(8), b: f(4) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    return { h, s: max ? Math.round(d / max * 100) : 0, v: Math.round(max * 100) };
  }
  const hex = (n) => Math.round(n).toString(16).padStart(2, "0");
  function luminance(r, g, b) {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function contrast(rgb1, rgb2) {
    const l1 = luminance(rgb1.r, rgb1.g, rgb1.b), l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function render() {
    const c = parseColor(inp.value) || parseColor(picker.value);
    out.textContent = "";
    if (!c) {
      out.append(el("div", { class: "panel", style: "border-color:var(--bad)" },
        el("span", { class: "label", text: "Couldn't read that colour" }),
        el("p", { style: "margin:0;font-size:13px;color:var(--muted)", text: "Try a hex code like #2f6b4f, rgb(47,107,79), hsl(152,39%,30%) or a basic name like teal." })));
      return;
    }
    picker.value = "#" + hex(c.r) + hex(c.g) + hex(c.b);
    const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
    const v = rgbToHsv(c.r, c.g, c.b);
    const k = 1 - Math.max(c.r, c.g, c.b) / 255;
    const cmyk = k === 1 ? [0, 0, 0, 100] : [
      Math.round((1 - c.r / 255 - k) / (1 - k) * 100),
      Math.round((1 - c.g / 255 - k) / (1 - k) * 100),
      Math.round((1 - c.b / 255 - k) / (1 - k) * 100),
      Math.round(k * 100)
    ];
    const hexFull = ("#" + hex(c.r) + hex(c.g) + hex(c.b)).toUpperCase();
    const alpha = c.a < 1 ? (" · alpha " + Math.round(c.a * 100) + "%") : "";
    out.append(el("div", { class: "result-head" },
      el("h3", { text: (NAMES[hexFull.toLowerCase()] ? NAMES[hexFull.toLowerCase()] + " — " : "") + hexFull + alpha }),
      el("span", { class: "label", text: "every model at once" })));
    const swatch = el("div", { style: `height:74px;border-radius:10px;border:1.5px solid var(--line);margin-top:12px;background:${hexFull}` });
    out.append(swatch);

    const rows = [
      ["HEX", hexFull + (c.a < 1 ? hex(c.a * 255) : "")],
      ["RGB", `rgb(${c.r}, ${c.g}, ${c.b})` + (c.a < 1 ? ` / ${Math.round(c.a * 100)}%` : "")],
      ["HSL", `hsl(${h}, ${s}%, ${l}%)`],
      ["HSV / HSB", `hsv(${v.h}, ${v.s}%, ${v.v}%)`],
      ["CMYK", `${cmyk[0]}, ${cmyk[1]}, ${cmyk[2]}, ${cmyk[3]} (print)`]
    ];
    const list = el("div", { class: "results", style: "margin-top:12px" });
    for (const [name, val] of rows) {
      list.append(el("div", { class: "rcard" },
        el("div", { class: "rcard__body" },
          el("div", { class: "label", text: name }),
          el("div", { class: "mono", style: "font-size:14px;margin-top:3px", text: val })),
        el("div", { class: "rcard__actions" },
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(val) }, "Copy"))));
    }
    out.append(list);

    /* contrast */
    const onWhite = contrast(c, { r: 255, g: 255, b: 255 });
    const onBlack = contrast(c, { r: 0, g: 0, b: 0 });
    const verdict = (ratio) => ratio >= 7 ? "AAA ✓" : ratio >= 4.5 ? "AA ✓" : ratio >= 3 ? "large text only" : "fails WCAG";
    out.append(el("div", { class: "panel", style: "margin-top:14px" },
      el("span", { class: "label", text: "Readability (WCAG)" }),
      el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:8px" },
        el("div", { style: `flex:1;min-width:150px;padding:12px;border-radius:8px;background:#fff;color:${hexFull};border:1.5px solid var(--line)` },
          el("div", { style: "font-size:15px;font-weight:600", text: "Text on white" }),
          el("div", { class: "mono", style: "font-size:12.5px;margin-top:4px", text: onWhite.toFixed(2) + ":1 — " + verdict(onWhite) })),
        el("div", { style: `flex:1;min-width:150px;padding:12px;border-radius:8px;background:#111;color:${hexFull};border:1.5px solid var(--line)` },
          el("div", { style: "font-size:15px;font-weight:600", text: "Text on black" }),
          el("div", { class: "mono", style: "font-size:12.5px;margin-top:4px", text: onBlack.toFixed(2) + ":1 — " + verdict(onBlack) })))));

    /* shades */
    const shades = el("div", { style: "display:flex;border-radius:8px;overflow:hidden;margin-top:14px;border:1.5px solid var(--line)" });
    for (let step = 9; step >= 1; step--) {
      const l2 = step / 10;
      const rgb2 = hslToRgb(h, s / 100, l2);
      const hx = "#" + hex(rgb2.r) + hex(rgb2.g) + hex(rgb2.b);
      shades.append(el("button", { type: "button", title: hx + " — click to use",
        style: `flex:1;height:44px;background:${hx};border:none;cursor:pointer`,
        onclick: () => { inp.value = hx; render(); } }));
    }
    out.append(shades);
    out.append(el("span", { class: "hint", style: "margin-top:6px;display:block", text: "Shades of the same hue — click any strip to copy it into the box." }));
  }

  let t = null;
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(render, 200); });
  picker.addEventListener("input", () => { inp.value = picker.value; render(); });
  render();
})();
