/* Case Converter — every useful casing at once, each with its own copy button. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Identifier styles (camel, snake…) split on spaces, dashes, camel bumps and underscores — so \"user_accountID\" and \"User account ID\" both behave. Results update as you type." }));
  side.append(note);

  const ta = DP.textArea("Type or paste text — every casing appears below, live…", 9);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  const words = (s) => s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  const variants = (src) => {
    const w = words(src);
    const lower = src.toLowerCase();
    const title = src.replace(/\b([a-z])/gi, (m) => m.toUpperCase());
    const sentence = lower.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
    const camel = w.map((x, i) => i === 0 ? x.toLowerCase() : x[0].toUpperCase() + x.slice(1).toLowerCase()).join("");
    const pascal = w.map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join("");
    const snake = w.map(x => x.toLowerCase()).join("_");
    const kebab = w.map(x => x.toLowerCase()).join("-");
    const constant = w.map(x => x.toUpperCase()).join("_");
    const dot = w.map(x => x.toLowerCase()).join(".");
    let alt = "", up = false;
    for (const ch of src) { alt += /[a-z]/i.test(ch) ? (up = !up) ? ch.toUpperCase() : ch.toLowerCase() : ch; }
    return [
      ["lowercase", lower],
      ["UPPERCASE", src.toUpperCase()],
      ["Title Case", title],
      ["Sentence case", sentence],
      ["camelCase", camel],
      ["PascalCase", pascal],
      ["snake_case", snake],
      ["kebab-case", kebab],
      ["CONSTANT_CASE", constant],
      ["dot.case", dot],
      ["aLtErNaTiNg CaSe", alt]
    ];
  };

  let timer = null;
  function render() {
    const src = ta.value;
    out.textContent = "";
    if (!src.trim()) {
      out.append(el("div", { class: "empty", text: "Type above — lowercase, UPPERCASE, camelCase, snake_case and seven more appear here instantly." }));
      return;
    }
    const head = el("div", { class: "result-head" }, el("h3", { text: "All casings" }), el("span", { class: "label", text: `${words(src).length} words` }));
    out.append(head);
    const list = el("div", { class: "results", style: "margin-top:4px" });
    for (const [label, val] of variants(src)) {
      list.append(el("div", { class: "rcard", style: "align-items:flex-start" },
        el("div", { class: "rcard__body" },
          el("div", { class: "label", text: label }),
          el("div", { class: "mono", style: "font-size:13px;word-break:break-word;white-space:pre-wrap;margin-top:3px;max-height:130px;overflow:auto", text: val.length > 2000 ? val.slice(0, 2000) + "…" : val })),
        el("div", { class: "rcard__actions" },
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(val) }, "Copy"))));
    }
    out.append(list);
  }

  ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 250); });
  render();
})();
