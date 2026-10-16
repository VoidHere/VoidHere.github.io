/* Number Base Converter — exact maths with BigInt, so nothing rounds off. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The number" }));
  side.append(panel);
  const baseSel = el("select", { class: "select" }, [
    el("option", { value: "auto", text: "Auto-detect (0x, 0b, 0o…)" }),
    el("option", { value: "2", text: "Base 2 — binary" }),
    el("option", { value: "8", text: "Base 8 — octal" }),
    el("option", { value: "10", text: "Base 10 — decimal" }),
    el("option", { value: "16", text: "Base 16 — hex" }),
    el("option", { value: "36", text: "Base 36 — full alphabet" })
  ]);
  const extraIn = el("input", { class: "input", type: "number", min: "2", max: "36", value: "32", style: "margin-top:8px" });
  panel.append(el("div", { class: "field" }, el("span", { class: "label", text: "Reading it as" }), baseSel));
  panel.append(el("div", { class: "field", style: "margin-top:8px" }, el("span", { class: "label", text: "…plus one custom base" }), extraIn));
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Built on BigInt, so a 200-digit number stays exact — no silent rounding at 2^53 like calculator apps. Whole numbers only; digits beyond 9 are a–z." }));
  side.append(note);

  const inp = el("input", { class: "input", spellcheck: "false", placeholder: "e.g. 255, 0xFF, 0b1010, 777, or huge numbers…",
    style: "font-family:var(--mono);font-size:16px;margin-top:18px" });
  app.append(inp);

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  function digitVal(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 48 && c <= 57) return c - 48;
    if (c >= 97 && c <= 122) return c - 87;
    if (c >= 65 && c <= 90) return c - 55;
    return -1;
  }
  function parseBase(s, base) {
    let neg = false;
    if (s[0] === "-") { neg = true; s = s.slice(1); }
    let acc = 0n;
    const B = BigInt(base);
    for (const ch of s) {
      const d = digitVal(ch);
      if (d < 0 || d >= base) throw new Error(`"${ch}" isn't a digit in base ${base}.`);
      acc = acc * B + BigInt(d);
    }
    return neg ? -acc : acc;
  }
  function detect(s) {
    if (/^-?0x/i.test(s)) return 16;
    if (/^-?0b/i.test(s)) return 2;
    if (/^-?0o/i.test(s)) return 8;
    return 10;
  }

  function render() {
    const raw = inp.value.replace(/[\s_,]/g, "");
    out.textContent = "";
    if (!raw) { out.append(el("div", { class: "empty", text: "Type a number — it's converted to every base as you type." })); return; }
    const chosenBase = baseSel.value === "auto" ? detect(raw) : parseInt(baseSel.value, 10);
    let work = raw;
    if (chosenBase === 16) work = work.replace(/^-?0x/i, (m) => m[0] === "-" ? "-" : "");
    else if (chosenBase === 2) work = work.replace(/^-?0b/i, (m) => m[0] === "-" ? "-" : "");
    else if (chosenBase === 8) work = work.replace(/^-?0o/i, (m) => m[0] === "-" ? "-" : "");
    let n;
    try { n = parseBase(work, chosenBase); }
    catch (e) {
      out.append(el("div", { class: "panel", style: "border-color:var(--bad)" },
        el("span", { class: "label", text: "Can't read that in base " + chosenBase }),
        el("p", { class: "mono", style: "margin:0;font-size:13px;color:var(--bad)", text: e.message })));
      return;
    }
    const custom = Math.max(2, Math.min(36, Math.round(Number(extraIn.value) || 32)));
    const rows = [
      ["Binary (2)", n.toString(2)],
      ["Octal (8)", n.toString(8)],
      ["Decimal (10)", n.toString(10)],
      ["Hexadecimal (16)", n.toString(16).toUpperCase()],
      ["Base 36", n.toString(36).toUpperCase()],
      [`Base ${custom}`, n.toString(custom).toUpperCase()]
    ];
    const bits = n === 0n ? 1 : n.toString(2).replace("-", "").length;
    out.append(el("div", { class: "result-head" },
      el("h3", { text: "Read as base " + chosenBase }),
      el("span", { class: "label", text: bits + " bit" + (bits === 1 ? "" : "s") + " · " + n.toString(10).length + " decimal digits" })));
    const list = el("div", { class: "results", style: "margin-top:4px" });
    for (const [name, val] of rows) {
      list.append(el("div", { class: "rcard", style: "align-items:flex-start" },
        el("div", { class: "rcard__body" },
          el("div", { class: "label", text: name }),
          el("div", { class: "mono", style: "font-size:14px;margin-top:3px;word-break:break-all", text: val.length > 4000 ? val.slice(0, 4000) + "…" : val })),
        el("div", { class: "rcard__actions" },
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(val) }, "Copy"))));
    }
    out.append(list);
  }

  inp.addEventListener("input", render);
  baseSel.addEventListener("change", render);
  extraIn.addEventListener("input", render);
  render();
})();
