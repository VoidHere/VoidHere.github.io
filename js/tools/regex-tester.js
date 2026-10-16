/* Regex Tester — see matches highlighted, groups explained, live as you type. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Pattern" }));
  side.append(panel);
  const patIn = el("input", { class: "input", spellcheck: "false", placeholder: "e.g.  \\b\\w+@\\w+\\.\\w{2,}\\b",
    style: "font-family:var(--mono);font-size:13px" });
  panel.append(patIn);
  const flagRow = el("div", { style: "display:flex;gap:14px;flex-wrap:wrap;margin-top:10px" });
  const FLAGS = [["g", "global", true], ["i", "ignore case", true], ["m", "multiline", false], ["s", "dotall", false], ["u", "unicode", false]];
  const flagBoxes = {};
  for (const [f, label, def] of FLAGS) {
    const cb = el("input", { type: "checkbox" });
    cb.checked = def;
    flagBoxes[f] = cb;
    flagRow.append(el("label", { class: "check" }, cb, el("span", { class: "mono", style: "font-size:12px", text: f + " — " + label })));
  }
  panel.append(flagRow);
  const EX = [
    ["Email", "\\b[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}\\b"],
    ["URL", "https?://[^\\s\"'<>]+"],
    ["Date YYYY-MM-DD", "\\b\\d{4}-\\d{2}-\\d{2}\\b"],
    ["Hex colour", "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b"],
    ["Duplicate word", "\\b(\\w+)\\s+\\1\\b"]
  ];
  const exRow = el("div", { class: "btn-row", style: "margin-top:12px" });
  for (const [label, pat] of EX) exRow.append(el("button", { class: "btn btn--sm", type: "button", onclick: () => { patIn.value = pat; run(); } }, label));
  panel.append(el("span", { class: "label", style: "margin-top:14px;display:block", text: "Try one" }), exRow);

  const ta = DP.textArea("Paste the text to test against…", 10);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let timer = null;

  function run() {
    clearTimeout(timer);
    timer = setTimeout(doRun, 250);
  }
  function doRun() {
    const src = ta.value;
    const pat = patIn.value;
    out.textContent = "";
    if (!pat) { out.append(el("div", { class: "empty", text: "Type a pattern — or hit one of the examples — and matches appear here as you type." })); return; }
    const flags = Object.keys(flagBoxes).filter(f => flagBoxes[f].checked).join("");
    let re;
    try { re = new RegExp(pat, flags); }
    catch (e) {
      out.append(el("div", { class: "panel", style: "border-color:var(--bad)" },
        el("span", { class: "label", text: "The pattern doesn't compile" }),
        el("p", { class: "mono", style: "margin:0;font-size:13px;color:var(--bad)", text: e.message })));
      return;
    }
    const matches = [];
    const global = flags.includes("g");
    if (global) {
      let m, guard = 0;
      const r2 = new RegExp(pat, flags);
      while ((m = r2.exec(src)) !== null && guard++ < 5000) {
        matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
        if (m.index === r2.lastIndex) r2.lastIndex++;
      }
    } else {
      const m = re.exec(src);
      if (m) matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
    }
    const capped = matches.slice(0, 500);
    const head = el("div", { class: "result-head" },
      el("h3", { text: matches.length ? `${DP.plural(matches.length, "match")} found` : "No matches — the pattern is valid, just picky" }),
      el("span", { class: "label", text: flags || "(no flags)" }));
    out.append(head);
    if (capped.length) {
      /* highlighted text */
      let html = "", last = 0;
      for (const m of capped) {
        html += esc(src.slice(last, m.index));
        html += '<mark style="background:rgba(212,160,23,.32);border-radius:3px;padding:0 1px">' + esc(m.text) + "</mark>";
        last = m.index + m.text.length;
        if (!m.text.length) last++;
      }
      html += esc(src.slice(last));
      out.append(el("div", { html,
        style: "margin-top:12px;border:1.5px solid var(--line);border-radius:8px;padding:14px 16px;font-family:var(--mono);font-size:12.5px;line-height:1.8;white-space:pre-wrap;word-break:break-word;max-height:340px;overflow:auto" }));
      /* group table */
      const tbl = el("table", { style: "width:100%;border-collapse:collapse;margin-top:12px;font-size:12.5px" });
      tbl.append(el("tr", {},
        el("th", { style: "text-align:left;padding:5px 12px 5px 0;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line)", text: "#" }),
        el("th", { style: "text-align:left;padding:5px 12px 5px 0;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line)", text: "match" }),
        el("th", { style: "text-align:left;padding:5px 0;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line)", text: "at" }),
        el("th", { style: "text-align:left;padding:5px 0 5px 12px;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line)", text: "groups" })));
      capped.slice(0, 100).forEach((m, i) => {
        const gs = [];
        m.groups.forEach((g, gi) => { if (g !== undefined) gs.push(`$${gi + 1} = ${g}`); });
        if (m.named) for (const k of Object.keys(m.named)) gs.push(`${k} = ${m.named[k]}`);
        tbl.append(el("tr", {},
          el("td", { style: "padding:4px 12px 4px 0;color:var(--muted);vertical-align:top", text: String(i + 1) }),
          el("td", { class: "mono", style: "padding:4px 12px 4px 0;vertical-align:top;word-break:break-word", text: m.text.slice(0, 160) }),
          el("td", { class: "mono", style: "padding:4px 12px 4px 0;color:var(--muted);vertical-align:top", text: String(m.index) }),
          el("td", { class: "mono", style: "padding:4px 0;color:var(--muted);vertical-align:top;word-break:break-word", text: gs.join(", ") || "—" })));
      });
      out.append(el("div", { class: "panel", style: "margin-top:14px;overflow-x:auto" }, tbl));
      if (matches.length > 100) out.append(el("span", { class: "hint", text: "Table shows the first 100; highlighting covers the first 500." }));
    }
  }

  patIn.addEventListener("input", run);
  ta.addEventListener("input", run);
  for (const f of Object.keys(flagBoxes)) flagBoxes[f].addEventListener("change", run);
  doRun();
})();
