/* Word Counter — live counts, reading time and the words you lean on most. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "The maths" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Reading at 200 words a minute, speaking at 130 — the speeds of a relaxed reader and a clear presenter. Counts update as you type; nothing you paste goes anywhere." }));
  side.append(note);

  const ta = DP.textArea("Paste or type — counts update live…", 12);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  const STOP = new Set("the a an and or but of to in on at for with from by as is are was were be been being it its this that these those i you he she we they them his her their our your my me us not no do does did have has had will would can could should shall may might must if then than so such when where which who whom what how all any both each few more most other some into over under again further once here there why".split(" "));

  function fmtTime(mins) {
    if (mins < 1) { const s = Math.max(1, Math.round(mins * 60)); return s + " sec"; }
    const m = Math.floor(mins), s = Math.round((mins - m) * 60);
    return m + " min" + (s ? " " + s + " sec" : "");
  }

  function render() {
    const src = ta.value;
    out.textContent = "";
    const trimmed = src.trim();
    const wordArr = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const words = wordArr.length;
    const chars = src.length;
    const charsNoSpace = src.replace(/\s/g, "").length;
    const sentences = trimmed ? trimmed.split(/[.!?]+(?=\s|$)/).map(s => s.trim()).filter(s => /[A-Za-z0-9]/.test(s)).length : 0;
    const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).length : 0;
    const lines = src ? src.split("\n").length : 0;

    const stats = [
      ["Words", words.toLocaleString()],
      ["Characters", chars.toLocaleString()],
      ["Without spaces", charsNoSpace.toLocaleString()],
      ["Sentences", sentences.toLocaleString()],
      ["Paragraphs", paragraphs.toLocaleString()],
      ["Lines", lines.toLocaleString()],
      ["Reading time", words ? fmtTime(words / 200) : "—"],
      ["Speaking time", words ? fmtTime(words / 130) : "—"]
    ];
    const grid = el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px" });
    for (const [label, val] of stats) {
      grid.append(el("div", { class: "panel", style: "margin:0" },
        el("span", { class: "label", text: label }),
        el("div", { class: "mono", style: "font-size:21px;margin-top:4px", text: val })));
    }
    out.append(grid);

    const freq = new Map();
    for (const w of wordArr) {
      const k = w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
      if (!k || k.length < 3 || STOP.has(k)) continue;
      freq.set(k, (freq.get(k) || 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (top.length) {
      const max = top[0][1];
      const tbl = el("div", { class: "panel", style: "margin-top:14px" });
      tbl.append(el("span", { class: "label", text: "Words you lean on" }));
      for (const [w, n] of top) {
        tbl.append(el("div", { style: "display:flex;align-items:center;gap:10px;margin-top:7px" },
          el("span", { class: "mono", style: "font-size:12.5px;width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text: w }),
          el("div", { style: `height:8px;border-radius:4px;background:var(--accent);width:${Math.round(n / max * 100)}%;max-width:220px;opacity:.75` }),
          el("span", { class: "mono", style: "font-size:12px;color:var(--muted)", text: "×" + n })));
      }
    }
  }

  let timer = null;
  ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 150); });
  render();
})();
