/* Zip Extractor — pull everything out of an archive, safely. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Folders come out flattened — the path is folded into the file name — because zip files with deep trees get unwieldy in a download list. Junk like __MACOSX and .DS_Store is skipped. Password-locked zips can't be opened here; remove the password first." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: ".zip,application/zip,application/x-zip-compressed",
    multiple: true, icon: "i-archive",
    title: "Drop .zip files", hint: "several at once is fine"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Unzip");
  runBtn.dataset.busy = "Unzipping…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const IMG_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" };
  const MAX_BYTES = 1500 * 1024 * 1024;
  const MAX_FILES = 3000;

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a .zip file first.");
    const items = [];
    let extractedBytes = 0;
    const prog = DP.progress(out, "Opening…");
    for (const f of files) {
      let zip;
      try { zip = await JSZip.loadAsync(f); }
      catch (e) { DP.toast(`Couldn't open "${f.name}" — is it really a zip?`, "err"); continue; }
      const entries = Object.values(zip.files).filter(e =>
        !e.dir && !/^__MACOSX\//i.test(e.name) && !/(^|[\\/])\.DS_Store$/i.test(e.name) && !/(^|[\\/])Thumbs\.db$/i.test(e.name));
      if (!entries.length) { DP.toast(`"${f.name}" has no files inside.`, "err"); continue; }
      if (items.length + entries.length > MAX_FILES) {
        DP.toast(`Stopping: "${f.name}" would push past ${MAX_FILES} files — that smells like a zip bomb.`, "err");
        break;
      }
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        try {
          const blob = await entry.async("blob");
          extractedBytes += blob.size;
          if (extractedBytes > MAX_BYTES) {
            throw new Error(`over ${DP.fmtBytes(MAX_BYTES)} extracted — stopping as a precaution`);
          }
          const flat = entry.name.replace(/[/\\]+/g, " – ").trim();
          const ext = DP.getExt(entry.name);
          const type = IMG_EXT[ext] || "application/octet-stream";
          const typed = blob.type ? blob : blob.slice(0, blob.size, type);
          prog.set((i + 1) / entries.length * 100, `${f.name} — ${i + 1} of ${entries.length}…`);
          items.push({ name: flat, blob: typed, thumb: await DP.thumbFromBlob(typed), meta: `${DP.fmtBytes(blob.size)} · from ${f.name}` });
        } catch (e) {
          DP.toast(`Skipped "${entry.name}" — ${e.message}`, "err");
          if (/stopping as a precaution/.test(e.message)) throw new Error(e.message);
        }
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing could be extracted.");
    DP.results(out, items, { title: `${DP.plural(items.length, "file")} extracted`, note: "folders are folded into file names", zipName: "extracted-files.zip" });
  }));
})();
