/* CSV to JSON — headers become keys, quotes and commas handled properly. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Reading" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "delim", type: "seg", label: "Separator", value: "auto", options: [
      { v: "auto", label: "Auto" }, { v: ",", label: "Comma" }, { v: ";", label: "Semicolon" }, { v: "\t", label: "Tab" } ] },
    { k: "header", type: "check", label: "First row is column names", value: true,
      hint: "Off = arrays of values instead of objects." },
    { k: "pretty", type: "check", label: "Pretty print", value: true }
  ]);

  const ta = DP.textArea("Paste CSV here…", 9);
  app.append(ta);
  let lastName = "data";
  const dz = DP.dropzone(app, {
    accept: ".csv,.tsv,.txt,text/csv,text/plain", compact: true, icon: "i-text",
    title: "…or drop a .csv file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) { ta.value = await files[0].text(); lastName = DP.stripExt(files[0].name); } }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to JSON");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function pickDelim(text, mode) {
    if (mode !== "auto") return mode;
    const line = (text.split(/\r?\n/).find(l => l.trim()) || "").slice(0, 2000);
    const counts = [[",", (line.match(/,/g) || []).length], [";", (line.match(/;/g) || []).length], ["\t", (line.match(/\t/g) || []).length]];
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : ",";
  }
  function parseCSV(text, delim) {
    const rows = []; let row = [], field = "", i = 0, inQ = false;
    while (i < text.length) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"' && field === "") { inQ = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ""; i++; continue; }
      if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      field += ch; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste some CSV (or drop a file) first.");
    const o = chosen.read();
    const delim = pickDelim(src, o.delim);
    const rows = parseCSV(src, delim);
    if (!rows.length) throw new Error("That doesn't look like CSV — no rows found.");
    let data;
    if (o.header) {
      const heads = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
      data = rows.slice(1).map(r => {
        const obj = {};
        heads.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ""; });
        return obj;
      });
    } else {
      data = rows;
    }
    const res = JSON.stringify(data, null, o.pretty ? 2 : 0);
    DP.textResult(out, {
      title: `${DP.plural(data.length, "row")} converted`,
      text: res,
      mime: "application/json",
      filename: lastName + ".json",
      meta: `${rows.length} rows read · separator "${delim === "\t" ? "tab" : delim}"`
    });
  }));
})();
