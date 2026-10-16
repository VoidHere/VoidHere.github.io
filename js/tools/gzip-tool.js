/* Gzip Tool — .gz compress and decompress, the Unix kind, in the browser. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Direction" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Do", value: "gz", options: [
      { v: "gz", label: "Compress → .gz" }, { v: "un", label: "Decompress .gz" } ],
      onChange: (v) => {
        runBtn.textContent = v === "un" ? "Decompress .gz" : "Gzip it";
        runBtn.dataset.busy = v === "un" ? "Decompressing…" : "Compressing…";
      } },
    { k: "level", type: "range", label: "Compression level", min: 1, max: 9, value: 6, fmt: v => "level " + v,
      hint: "6 is gzip's classic default; 9 tries harder for a little more." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Real gzip format — the .gz files that gzip, gunzip and every server recognise. Drop any file to squeeze it, or a .gz to get the original back byte-for-byte. Text pasted in the box can be compressed too." }));
  side.append(note);

  const ta = DP.textArea("Optional — text to compress (leave empty to work on dropped files)…", 4);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: "any", compact: true, icon: "i-util",
    title: "Drop files (or .gz files)", hint: "works with any file type",
    onFiles: (files) => {
      /* pick the direction from what was dropped: all .gz → decompress, anything else → compress */
      if (!files.length) return;
      const want = files.every(f => /\.gz$/i.test(f.name)) ? "un" : "gz";
      if (chosen.read().mode !== want) chosen.set("mode", want);
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Gzip it");
  runBtn.dataset.busy = "Compressing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function sniffText(bytes) {
    try {
      const t = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(0, 4096));
      if (/[\x00-\x08\x0E-\x1F]/.test(t)) return null;
      return "text/plain";
    } catch (e) { return null; }
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const o = chosen.read();
    const files = dz.files;
    const text = ta.value;
    const hasText = text.trim().length > 0;
    if (!files.length && !hasText) throw new Error("Drop a file or type some text first.");
    const items = [];
    const prog = DP.progress(out, "Working…");

    if (o.mode === "gz") {
      if (files.length) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
          const gz = fflate.gzipSync(new Uint8Array(await f.arrayBuffer()), { level: o.level });
          const blob = new Blob([gz], { type: "application/gzip" });
          const pct = Math.round((1 - blob.size / f.size) * 100);
          items.push({ name: f.name + ".gz", blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)} (${pct >= 0 ? pct + "% smaller" : Math.abs(pct) + "% bigger — already compressed?"})` });
        }
      } else {
        prog.set(50, "Compressing the text…");
        const gz = fflate.gzipSync(fflate.strToU8(text), { level: o.level });
        const blob = new Blob([gz], { type: "application/gzip" });
        const raw = new TextEncoder().encode(text);
        items.push({ name: "text.txt.gz", blob, meta: `${DP.fmtBytes(raw.length)} text → ${DP.fmtBytes(blob.size)} gzip` });
      }
    } else {
      if (!files.length) throw new Error("Decompressing needs the .gz file — drop it below. (The text box is for compressing.)");
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
          const raw = fflate.gunzipSync(new Uint8Array(await f.arrayBuffer()));
          const type = sniffText(raw) || "application/octet-stream";
          const blob = new Blob([raw], { type });
          const name = /\.gz$/i.test(f.name) ? DP.stripExt(f.name) : f.name + ".ungz";
          items.push({ name, blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}${type === "text/plain" ? " · text" : ""}` });
        } catch (e) {
          DP.toast(`Couldn't decompress "${f.name}" — not a valid gzip file?`, "err");
        }
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing came out — check the mode and the files.");
    DP.results(out, items, { title: o.mode === "gz" ? "Squeezed" : "Decompressed", zipName: "gzip-results.zip" });
  }));
})();
