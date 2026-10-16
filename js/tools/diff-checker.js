/* Diff Checker — line-by-line, readable, with a downloadable patch. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Green lines are additions, red are removals, and long stretches of untouched text get folded away. When you need to hand the change to someone, grab the .patch — it applies with git apply or patch -p0." }));
  side.append(note);
  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Comparison" }));
  const ignore = el("label", { class: "check" },
    el("input", { type: "checkbox" }),
    el("span", { text: "Ignore leading/trailing whitespace" }));
  panel.append(ignore);
  side.append(panel);

  const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px" });
  const taA = el("textarea", { class: "input", spellcheck: "false", placeholder: "Original — paste the first version here…",
    style: "font-family:var(--mono);font-size:12.5px;line-height:1.6;min-height:220px;resize:vertical" });
  const taB = el("textarea", { class: "input", spellcheck: "false", placeholder: "Changed — the second version…",
    style: "font-family:var(--mono);font-size:12.5px;line-height:1.6;min-height:220px;resize:vertical" });
  grid.append(taA, taB);
  app.append(grid);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Compare");
  runBtn.dataset.busy = "Comparing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function renderDiff(host, a, b, ignoreWs) {
    host.textContent = "";
    const parts = Diff.diffLines(a, b, { ignoreWhitespace: !!ignoreWs });
    let adds = 0, dels = 0;
    for (const p of parts) {
      const n = p.count || p.value.split("\n").length;
      if (p.added) adds += n;
      if (p.removed) dels += n;
    }
    host.append(el("div", { class: "result-head" },
      el("h3", { text: adds === 0 && dels === 0 ? "Identical — nothing changed" : `${adds} added, ${dels} removed` }),
      el("span", { class: "label", text: ignoreWs ? "whitespace ignored" : "exact comparison" })));
    const box = el("div", { style: "margin-top:12px;border:1.5px solid var(--line);border-radius:8px;overflow:hidden;background:var(--paper)" });
    const style = {
      add: "display:block;padding:1px 10px;font-family:var(--mono);font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;background:rgba(46,160,67,.14);color:var(--ink)",
      del: "display:block;padding:1px 10px;font-family:var(--mono);font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;background:rgba(248,81,73,.13);color:var(--ink)",
      ctx: "display:block;padding:1px 10px;font-family:var(--mono);font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:var(--muted)"
    };
    let first = true;
    for (const p of parts) {
      const lines = p.value.replace(/\n$/, "").split("\n");
      if (p.added || p.removed) {
        const kind = p.added ? "add" : "del";
        const sign = p.added ? "+ " : "− ";
        for (const ln of lines) box.append(el("span", { style: style[kind], text: sign + ln }));
        first = false;
      } else if (lines.length > 9) {
        for (const ln of lines.slice(0, 3)) box.append(el("span", { style: style.ctx, text: "  " + ln }));
        box.append(el("span", { style: style.ctx + ";text-align:center;opacity:.7", text: `⋯ ${lines.length - 6} unchanged lines ⋯` }));
        for (const ln of lines.slice(-3)) box.append(el("span", { style: style.ctx, text: "  " + ln }));
      } else {
        for (const ln of lines) box.append(el("span", { style: style.ctx, text: "  " + ln }));
      }
    }
    host.append(box);
    const patch = Diff.createPatch("text.txt", a, b);
    host.append(el("div", { class: "btn-row", style: "margin-top:12px" },
      el("button", { class: "btn btn--sm btn--primary", type: "button", onclick: () => DP.copyText(patch) }, "Copy patch"),
      el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(patch, "changes.patch", "text/x-patch") }, "Download .patch")));
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!taA.value && !taB.value) throw new Error("Paste something into at least one side.");
    renderDiff(out, taA.value, taB.value, ignore.querySelector("input").checked);
  }));
})();
