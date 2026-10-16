/* Timestamp Converter — epoch ↔ human, in every format you'll actually need. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "A plain number is read by length: 10 digits = seconds, 13 = milliseconds, 16 = microseconds, 19 = nanoseconds. Anything else is parsed as a date string, as liberally as your browser can. Your own timezone does the local maths." }));
  side.append(note);
  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Quick fill" }));
  const nowBtn = el("button", { class: "btn btn--sm", type: "button" }, "Use right now");
  const todayBtn = el("button", { class: "btn btn--sm", type: "button" }, "Midnight today");
  const epochBtn = el("button", { class: "btn btn--sm", type: "button" }, "Epoch zero (0)");
  panel.append(el("div", { class: "btn-row" }, nowBtn, todayBtn, epochBtn));
  side.append(panel);

  const ta = DP.textArea("Paste a timestamp (1729000000), a date (2026-01-30), or anything date-ish…", 4);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  nowBtn.addEventListener("click", () => { ta.value = String(Date.now()); });
  todayBtn.addEventListener("click", () => { const d = new Date(); d.setHours(0, 0, 0, 0); ta.value = String(Math.floor(d.getTime() / 1000)); });
  epochBtn.addEventListener("click", () => { ta.value = "0"; });

  function relative(ms) {
    const diff = ms - Date.now();
    const abs = Math.abs(diff);
    const units = [["year", 31536000000], ["month", 2592000000], ["day", 86400000], ["hour", 3600000], ["minute", 60000], ["second", 1000]];
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [unit, size] of units) {
      if (abs >= size || unit === "second") return rtf.format(Math.round(diff / size), unit);
    }
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value.trim();
    if (!src) throw new Error("Paste a timestamp or a date first.");
    let ms, how;
    if (/^-?\d+$/.test(src)) {
      const n = Number(src);
      const len = src.replace("-", "").length;
      if (len <= 10) { ms = n * 1000; how = "read as Unix seconds (10-digit)"; }
      else if (len === 13) { ms = n; how = "read as Unix milliseconds (13-digit)"; }
      else if (len === 16) { ms = n / 1000; how = "read as Unix microseconds (16-digit)"; }
      else if (len === 19) { ms = n / 1e6; how = "read as Unix nanoseconds (19-digit)"; }
      else { ms = n; how = `${len}-digit number — treated as milliseconds`; }
    } else {
      const parsed = Date.parse(src);
      if (isNaN(parsed)) throw new Error("Couldn't read that as a date — try 2026-01-30, 30 Jan 2026, or a plain number.");
      ms = parsed;
      how = "parsed as a date string";
    }
    const d = new Date(ms);
    if (isNaN(d.getTime())) throw new Error("That date is outside the range JavaScript can represent.");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lines = [
      `Unix seconds      ${Math.floor(ms / 1000)}`,
      `Unix millis       ${ms}`,
      `ISO 8601 (UTC)    ${d.toISOString()}`,
      `UTC               ${d.toUTCString()}`,
      `Local (${tz})`.padEnd(18) + ` ${d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" })}`,
      `Relative to now   ${relative(ms)}`,
      ``,
      `Interpretation    ${how}`,
      `Day of week       ${d.toLocaleDateString(undefined, { weekday: "long" })}`,
      `ISO week          ${(() => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const yStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + "-W" + String(Math.ceil(((t - yStart) / 86400000 + 1) / 7)).padStart(2, "0"); })()}`
    ];
    DP.textResult(out, {
      title: "Converted every which way",
      text: lines.join("\n"),
      filename: "timestamp.txt",
      meta: how
    });
  }));
})();
