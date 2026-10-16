/* HTML Entities — escape for safety, unescape for reading. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Direction" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "dir", type: "seg", label: "Convert", value: "esc", options: [
      { v: "esc", label: "Escape" }, { v: "unesc", label: "Unescape" } ] },
    { k: "numeric", type: "check", label: "Numeric codes (&#38;)", value: false,
      hint: "Escape only. Some strict systems prefer numbers over names." },
    { k: "nonascii", type: "check", label: "Also &#-encode accents & symbols", value: false,
      hint: "Escape only — for ASCII-only pipelines." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Escaping covers the five that matter — & < > \" ' — because those are the ones that break markup, attributes and databases. Unescaping understands hundreds of named entities plus decimal and hex codes." }));
  side.append(note);

  const ta = DP.textArea("Paste text with entities, or text to escape…", 9);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: ".html,.txt,text/html,text/plain", compact: true, icon: "i-text",
    title: "…or drop a file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) ta.value = await files[0].text(); }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00A0", copy: "©", reg: "®", trade: "™", deg: "°", plusmn: "±", times: "×", divide: "÷", frac12: "½", frac14: "¼", frac34: "¾", hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·", dagger: "†", sect: "§", para: "¶", euro: "€", pound: "£", yen: "¥", cent: "¢", laquo: "«", raquo: "»", sup2: "²", sup3: "³", micro: "µ", infin: "∞", ne: "≠", le: "≤", ge: "≥", larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔", hearts: "♥", star: "☆", starf: "★", check: "✓", cross: "✗" };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste something first.");
    const o = chosen.read();
    let res, count = 0;
    if (o.dir === "esc") {
      if (o.numeric) {
        res = src.replace(/[&<>"']/g, (c) => { count++; return "&#" + c.charCodeAt(0) + ";"; });
      } else {
        res = src.replace(/[&<>"']/g, (c) => { count++; return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
      }
      if (o.nonascii) {
        res = res.replace(/[^\x00-\x7F]/g, (c) => { count++; return "&#" + c.codePointAt(0) + ";"; });
      }
      DP.textResult(out, {
        title: count ? "Escaped" : "Nothing to escape",
        text: res,
        mime: "text/html",
        filename: "escaped.txt",
        meta: count ? `${DP.plural(count, "character")} converted` : "no & < > \" or ' in sight"
      });
    } else {
      res = src.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, body) => {
        count++;
        if (body[0] === "#") {
          const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
          if (!isFinite(code) || code < 0 || code > 0x10FFFF) return m;
          try { return String.fromCodePoint(code); } catch (e) { return m; }
        }
        const hit = NAMED[body] ?? NAMED[body.toLowerCase()];
        return hit !== undefined ? hit : m;
      });
      DP.textResult(out, {
        title: count ? "Unescaped" : "No entities found",
        text: res,
        filename: "unescaped.txt",
        meta: count ? `${DP.plural(count, "entity")} converted` : "this text has no &…; entities"
      });
    }
  }));
})();
