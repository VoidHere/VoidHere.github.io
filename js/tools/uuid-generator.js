/* UUID Generator — v4 identifiers from the browser's own secure randomness. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "How many, how shaped" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "count", type: "number", label: "How many", value: 10, min: 1, max: 500 },
    { k: "case", type: "seg", label: "Case", value: "lower", options: [
      { v: "lower", label: "lowercase" }, { v: "upper", label: "UPPERCASE" } ] },
    { k: "shape", type: "seg", label: "Shape", value: "plain", options: [
      { v: "plain", label: "Standard" }, { v: "braces", label: "Braces {}" }, { v: "nodash", label: "No dashes" } ] }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Version 4 — pure random, 122 bits of it. Generated with the browser's cryptographic random source (crypto.getRandomValues), so they're fit for database keys, not just placeholders." }));
  side.append(note);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Generate");
  runBtn.dataset.busy = "Rolling dice…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function uuidv4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const make = (o) => {
    let u = uuidv4();
    if (o.shape === "nodash") u = u.replace(/-/g, "");
    else if (o.shape === "braces") u = "{" + u + "}";
    return o.case === "upper" ? u.toUpperCase() : u;
  };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const o = chosen.read();
    const n = Math.max(1, Math.min(500, Math.round(o.count)));
    const list = Array.from({ length: n }, () => make(o));
    DP.textResult(out, {
      title: n === 1 ? "One fresh UUID" : n + " fresh UUIDs",
      text: list.join("\n"),
      filename: "uuids.txt",
      meta: "version 4 · " + (crypto.randomUUID ? "crypto.randomUUID()" : "crypto.getRandomValues()")
    });
  }));
})();
