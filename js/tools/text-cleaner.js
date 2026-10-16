/* Text Cleaner — the quick comb-through: whitespace, quotes, invisible gremlins. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "What to fix" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "lines", type: "check", label: "Trim spaces from line ends", value: true },
    { k: "spaces", type: "check", label: "Collapse repeated spaces & tabs", value: true },
    { k: "blanks", type: "check", label: "Collapse blank runs to one line", value: true },
    { k: "empty", type: "check", label: "Remove empty lines entirely", value: false },
    { k: "quotes", type: "check", label: "Straighten curly quotes & dashes", value: true,
      hint: "\u201Csmart\u201D → \"straight\", — and – → -" },
    { k: "zero", type: "check", label: "Remove zero-width & invisible characters", value: true },
    { k: "eol", type: "check", label: "Unify line endings (Windows → Unix)", value: true }
  ]);

  const ta = DP.textArea("Paste the messy text here…", 10);
  app.append(ta,
    );
  const dz = DP.dropzone(app, {
    accept: ".txt,.md,.csv,.json,text/plain", compact: true, icon: "i-text",
    title: "…or drop a text file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) ta.value = await files[0].text(); }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Clean it up");
  runBtn.dataset.busy = "Cleaning…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const before = ta.value;
    if (!before.trim()) throw new Error("Paste some text first.");
    const o = chosen.read();
    let s = before;
    const fixes = [];
    if (o.eol) { const n = (s.match(/\r\n/g) || []).length; s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n"); if (n) fixes.push(`${n} Windows line ends`); }
    if (o.zero) { const n = (s.match(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g) || []).length; s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, ""); if (n) fixes.push(`${n} invisible characters`); }
    if (o.quotes) {
      const pairs = [["\u2018", "'"], ["\u2019", "'"], ["\u201C", '"'], ["\u201D", '"'], ["\u201E", '"'], ["\u2013", "-"], ["\u2014", "--"], ["\u2026", "..."]];
      let n = 0;
      for (const [a, b] of pairs) { const c = s.split(a).length - 1; n += c; s = s.split(a).join(b); }
      if (n) fixes.push(`${n} fancy characters`);
    }
    if (o.spaces) { const n = (s.match(/[ \t]{2,}/g) || []).length; s = s.replace(/[ \t]{2,}/g, " "); if (n) fixes.push(`${n} space runs`); }
    if (o.lines) {
      const linesArr = s.split("\n");
      let n = 0;
      for (let i = 0; i < linesArr.length; i++) {
        const t = linesArr[i].replace(/[ \t]+$/, "").replace(/^[ \t]+/, "");
        if (t !== linesArr[i]) n++;
        linesArr[i] = t;
      }
      s = linesArr.join("\n");
      if (n) fixes.push(`${n} untidy line ends`);
    }
    if (o.blanks) { const n = (s.match(/\n{3,}/g) || []).length; s = s.replace(/\n{3,}/g, "\n\n"); if (n) fixes.push(`${n} blank runs`); }
    if (o.empty) { const before2 = s.split("\n").length; s = s.split("\n").filter(l => l.trim() !== "").join("\n"); const n = before2 - s.split("\n").length; if (n) fixes.push(`${n} empty lines`); }
    DP.textResult(out, {
      title: fixes.length ? "Cleaned" : "Already spotless",
      text: s,
      filename: "cleaned.txt",
      meta: fixes.length ? fixes.join(" · ") : "nothing needed fixing — every chosen rule found zero violations"
    });
  }));
})();
