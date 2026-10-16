/* Zip Creator — pack any files into a single archive, folders included. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The archive" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "name", type: "text", label: "File name", value: "digitpdf-archive" },
    { k: "comp", type: "seg", label: "Compression", value: "deflate", options: [
      { v: "store", label: "None (fast)" }, { v: "deflate", label: "Balanced" }, { v: "max", label: "Maximum" } ] }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Drop whole folders if you like — the folder structure is kept inside the zip. Photos, videos and other already-compressed files won't shrink much (that's physics, not a bug); text, code and documents will." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "any",
    multiple: true, icon: "i-archive",
    title: "Drop files or folders to zip", hint: "everything stays here on your machine"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Build the zip");
  runBtn.dataset.busy = "Packing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop some files first.");
    const o = chosen.read();
    const zip = new JSZip();
    let total = 0;
    const seen = new Set();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let path = (f.webkitRelativePath || f.name).replace(/^[/\\]+/, "");
      if (!path) path = `file-${i + 1}`;
      while (seen.has(path)) path = path.replace(/(\.[^.]*)?$/, "_" + (i + 1) + "$1");
      seen.add(path);
      zip.file(path, f);
      total += f.size;
    }
    const prog = DP.progress(out, "Compressing…");
    const level = o.comp === "store" ? 0 : o.comp === "max" ? 9 : 6;
    const blob = await zip.generateAsync(
      { type: "blob", compression: o.comp === "store" ? "STORE" : "DEFLATE", compressionOptions: { level } },
      (meta) => prog.set(meta.percent, `Compressing — ${Math.round(meta.percent)}%`)
    );
    prog.done();
    const name = (o.name.trim() || "archive").replace(/\.zip$/i, "") + ".zip";
    const ratio = total ? Math.round((1 - blob.size / total) * 100) : 0;
    DP.results(out, [{
      name,
      blob,
      meta: `${DP.plural(files.length, "file")} · ${DP.fmtBytes(total)} → ${DP.fmtBytes(blob.size)}${ratio > 0 ? " (" + ratio + "% smaller)" : " · already compact"}`,
      thumb: null
    }], { title: "Archive ready", note: "single download, everything inside" });
  }));
})();
