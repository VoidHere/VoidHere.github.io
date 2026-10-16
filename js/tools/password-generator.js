/* Password Generator — unbiased randomness, honest strength maths. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Recipe" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "length", type: "range", label: "Length", min: 8, max: 64, value: 20, fmt: v => v + " characters" },
    { k: "count", type: "number", label: "How many", value: 5, min: 1, max: 50 },
    { k: "upper", type: "check", label: "Capital letters (A–Z)", value: true },
    { k: "lower", type: "check", label: "Small letters (a–z)", value: true },
    { k: "digits", type: "check", label: "Digits (0–9)", value: true },
    { k: "symbols", type: "check", label: "Symbols (!@#$…)", value: true },
    { k: "plain", type: "check", label: "Avoid look-alike characters", value: true,
      hint: "No 0/O, 1/l/I — for passwords you'll read aloud or retype." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Every character is drawn with rejection sampling — the statistical way to avoid bias, not just \"pick a random index\". Generated locally with the browser's crypto source; the only copy is the one you see." }));
  side.append(note);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Generate passwords");
  runBtn.dataset.busy = "Mixing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function pickFrom(pool) {
    const limit = 256 - (256 % pool.length);
    for (;;) {
      const b = crypto.getRandomValues(new Uint8Array(1))[0];
      if (b < limit) return pool[b % pool.length];
    }
  }
  function makeOne(o) {
    const sets = [];
    let upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let lower = "abcdefghijklmnopqrstuvwxyz";
    let digits = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{};:,.<>?/~";
    if (o.plain) {
      upper = upper.replace(/[IO]/g, "");
      lower = lower.replace(/[l]/g, "");
      digits = digits.replace(/[01]/g, "");
    }
    if (o.upper) sets.push(upper);
    if (o.lower) sets.push(lower);
    if (o.digits) sets.push(digits);
    if (o.symbols) sets.push(symbols);
    if (!sets.length) throw new Error("Pick at least one character set.");
    const all = sets.join("");
    const len = Math.max(sets.length, Math.round(o.length));
    const chars = [];
    for (const s of sets) chars.push(pickFrom(s));
    while (chars.length < len) chars.push(pickFrom(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return { pw: chars.join(""), poolSize: all.length };
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const o = chosen.read();
    const n = Math.max(1, Math.min(50, Math.round(o.count)));
    const made = [];
    for (let i = 0; i < n; i++) made.push(makeOne(o));
    const bits = Math.round(Math.log2(made[0].poolSize) * made[0].pw.length);
    const verdict = bits >= 100 ? "excellent" : bits >= 75 ? "strong" : bits >= 55 ? "decent" : "short — add length";
    const lines = made.map(m => m.pw);
    out.textContent = "";
    out.append(el("div", { class: "result-head" },
      el("h3", { text: n === 1 ? "Your password" : n + " passwords" }),
      el("span", { class: "label", text: `~${bits} bits of entropy · ${verdict}` })));
    const list = el("div", { class: "results", style: "margin-top:4px" });
    for (const m of made) {
      list.append(el("div", { class: "rcard" },
        el("div", { class: "rcard__body" },
          el("div", { class: "mono", style: "font-size:15px;word-break:break-all", text: m.pw })),
        el("div", { class: "rcard__actions" },
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(m.pw) }, "Copy"))));
    }
    out.append(list);
    out.append(el("div", { class: "btn-row", style: "margin-top:12px" },
      el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(lines.join("\n"), "passwords.txt") }, "Download .txt"),
      el("button", { class: "btn btn--sm", type: "button", onclick: () => runBtn.click() }, "Roll again")));
  }));
})();
