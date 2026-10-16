/* JSON to CSV — arrays of objects become a proper spreadsheet-ready file. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Writing" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "delim", type: "seg", label: "Separator", value: ",", options: [
      { v: ",", label: "Comma" }, { v: ";", label: "Semicolon" }, { v: "\t", label: "Tab" } ] },
    { k: "allKeys", type: "check", label: "One column per unique key", value: true,
      hint: "Off = only the keys of the first row." }
  ]);

  const ta = DP.textArea("Paste a JSON array here — e.g. [{\"name\":\"A\",\"qty\":2}, …]", 9);
  app.append(ta);
  let lastName = "data";
  const dz = DP.dropzone(app, {
    accept: ".json,.txt,application/json,text/plain", compact: true, icon: "i-text",
    title: "…or drop a .json file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) { ta.value = await files[0].text(); lastName = DP.stripExt(files[0].name); } }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to CSV");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const cell = (v) => {
    if (v == null) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v);
    return /[",\n\r]/.test(v) || v.includes("\t") ? '"' + v.replace(/"/g, '""') + '"' : v;
  };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste a JSON array first.");
    let data;
    try { data = JSON.parse(src); }
    catch (e) { throw new Error("That isn't valid JSON — " + e.message); }
    if (!Array.isArray(data)) throw new Error("This tool wants an array at the top level — like [ {…}, {…} ].");
    if (!data.length) throw new Error("The array is empty — nothing to write.");
    const o = chosen.read();
    const d = o.delim;
    let keys;
    if (data.every(x => Array.isArray(x))) {
      const width = Math.max(...data.map(a => a.length));
      const res = data.map(r => Array.from({ length: width }, (_, i) => cell(r[i])).join(d)).join("\n");
      return DP.textResult(out, { title: `${DP.plural(data.length, "row")} written`, text: res, mime: "text/csv", filename: lastName + ".csv", meta: `${width} columns` });
    }
    if (!data.every(x => x && typeof x === "object")) throw new Error("Rows need to be objects — {\"name\": \"A\"} — or arrays. Mixed types confuse spreadsheets.");
    if (o.allKeys) {
      keys = [];
      for (const row of data) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k);
    } else {
      keys = Object.keys(data[0]);
    }
    const lines = [keys.map(cell).join(d)];
    for (const row of data) lines.push(keys.map(k => cell(row[k])).join(d));
    const res = lines.join("\n");
    DP.textResult(out, {
      title: `${DP.plural(data.length, "row")} written`,
      text: res,
      mime: "text/csv",
      filename: lastName + ".csv",
      meta: `${keys.length} columns · separator "${d === "\t" ? "tab" : d}"`
    });
  }));
})();
