/* Excel Converter — every sheet out as JSON or CSV, nothing trapped in a workbook. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "format", type: "seg", label: "Write as", value: "json", options: [
      { v: "json", label: "JSON" }, { v: "csv", label: "CSV" } ] },
    { k: "header", type: "check", label: "First row has headers", value: true,
      hint: "JSON gets named fields; CSV always writes raw rows." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "XLSX, XLS and ODS all open here. Each sheet comes out as its own file — grab the ZIP if there are several. Formulas are read as their last calculated values." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: ".xlsx,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv",
    multiple: true, icon: "i-util",
    title: "Drop spreadsheets", hint: "XLSX, XLS, ODS (and CSV) — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Reading workbooks…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const cell = (v) => {
    if (v == null) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a spreadsheet first.");
    const o = chosen.read();
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
        const ext = DP.getExt(f.name);
        let wb;
        if (ext === "csv" || f.type === "text/csv") {
          wb = XLSX.read(await f.text(), { type: "string" });
        } else {
          wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        }
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          let text;
          if (o.format === "json") {
            const data = o.header
              ? XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" })
              : XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
            if (!data.length) continue;
            text = JSON.stringify(data, null, 2);
          } else {
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
            text = rows.map(r => r.map(cell).join(",")).join("\n");
          }
          const ext2 = o.format === "json" ? "json" : "csv";
          const mime = o.format === "json" ? "application/json" : "text/csv";
          const safe = sheetName.replace(/[\\/:*?"<>|]/g, "_").trim() || "Sheet";
          const blob = new Blob([text], { type: mime });
          items.push({
            name: `${DP.stripExt(f.name)} — ${safe}.${ext2}`,
            blob,
            meta: `${DP.fmtBytes(blob.size)}${wb.SheetNames.length > 1 ? " · sheet " + (wb.SheetNames.indexOf(sheetName) + 1) + " of " + wb.SheetNames.length : ""}`
          });
        }
      } catch (e) {
        DP.toast(`Couldn't read "${f.name}" — ${e.message}`, "err");
      }
    }
    prog.done();
    if (!items.length) throw new Error("No sheets came out — is this really a spreadsheet?");
    DP.results(out, items, { title: `${DP.plural(items.length, "sheet")} converted`, zipName: "spreadsheets-converted.zip" });
  }));
})();
