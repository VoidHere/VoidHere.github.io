/* CSV to Excel — plain text in, a proper .xlsx out, numbers typed as numbers. */
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
    { k: "sheet", type: "text", label: "Sheet name", value: "Sheet1", placeholder: "Sheet1" },
    { k: "types", type: "check", label: "Turn numbers and dates into real types", value: true,
      hint: "Off = everything lands as text." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Quoted fields with commas and line breaks survive the trip. Several CSVs in one drop make several little workbooks — or paste one into the box below." }));
  side.append(note);

  const ta = DP.textArea("Optional — paste CSV text directly here…", 5);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: ".csv,.tsv,.txt,text/csv,text/plain", compact: true, icon: "i-util",
    title: "Drop .csv files", hint: "or use the box above — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Build the workbook");
  runBtn.dataset.busy = "Building…";
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
  const NUM = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

  function toSheet(rows, o, sheetName) {
    const aoa = rows.map(r => r.map(v => {
      if (!o.types) return v;
      const t = v.trim();
      if (t !== "" && NUM.test(t)) return Number(t);
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; /* keep as text; Excel shows it cleanly */
      return v;
    }));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || "Sheet1").slice(0, 31) || "Sheet1");
    return wb;
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    const pasted = ta.value.trim();
    if (!files.length && !pasted) throw new Error("Drop a CSV file or paste CSV text first.");
    const o = chosen.read();
    const jobs = [];
    for (const f of files) jobs.push({ name: DP.stripExt(f.name), text: await f.text() });
    if (pasted) jobs.push({ name: "pasted", text: ta.value });
    const items = [];
    for (const job of jobs) {
      try {
        const rows = parseCSV(job.text, pickDelim(job.text, o.delim));
        if (!rows.length) throw new Error("no rows found");
        const wb = toSheet(rows, o, o.sheet);
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        items.push({
          name: `${job.name}.xlsx`,
          blob,
          meta: `${rows.length} rows × ${Math.max(...rows.map(r => r.length))} columns · ${DP.fmtBytes(blob.size)}`
        });
      } catch (e) {
        DP.toast(`Skipped "${job.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be converted.");
    DP.results(out, items, { title: `${DP.plural(items.length, "workbook")} ready`, zipName: "csv-workbooks.zip" });
  }));
})();
