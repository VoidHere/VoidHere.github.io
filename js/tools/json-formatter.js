/* JSON Formatter — pretty, minify, sort; errors explained by line. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Formatting" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "indent", type: "seg", label: "Indent", value: "2", options: [
      { v: "2", label: "2 spaces" }, { v: "4", label: "4 spaces" }, { v: "tab", label: "Tab" } ] },
    { k: "minify", type: "check", label: "Minify instead (one line)", value: false },
    { k: "sort", type: "check", label: "Sort keys A→Z", value: false,
      hint: "Deep sort — nested objects too." }
  ]);

  const ta = DP.textArea("Paste JSON here…", 10);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: ".json,.txt,application/json,text/plain", compact: true, icon: "i-text",
    title: "…or drop a .json file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) ta.value = await files[0].text(); }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Format");
  runBtn.dataset.busy = "Reformatting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function sortDeep(v) {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v).sort((a, b) => a.localeCompare(b))) o[k] = sortDeep(v[k]);
      return o;
    }
    return v;
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste some JSON first.");
    let parsed;
    try { parsed = JSON.parse(src); }
    catch (e) {
      const m = /position (\d+)/.exec(e.message);
      let where = "";
      if (m) {
        const pos = Number(m[1]);
        const before = src.slice(0, pos);
        const line = before.split(/\n/).length;
        const col = pos - before.lastIndexOf("\n");
        where = ` — around line ${line}, column ${col}`;
      }
      DP.textResult(out, { title: "That JSON has a problem", text: e.message + where + "\n\nCommon culprits: a trailing comma before } or ], single quotes, or an unquoted key.", rows: 6 });
      throw new Error("Invalid JSON" + where + " — details below the button.");
    }
    const o = chosen.read();
    if (o.sort) parsed = sortDeep(parsed);
    const indent = o.minify ? 0 : (o.indent === "tab" ? "\t" : Number(o.indent));
    const res = JSON.stringify(parsed, null, indent);
    if (res === undefined) throw new Error("That's valid JSON, but it's not an object or array we can reprint.");
    DP.textResult(out, {
      title: "Formatted",
      text: res,
      mime: "application/json",
      filename: "formatted.json",
      meta: `${DP.fmtBytes(src.length)} → ${DP.fmtBytes(res.length)} · ${res.split("\n").length} lines`
    });
  }));
})();
