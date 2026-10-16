/* Compress PDF — light structural pass, or strong page rendering that really shrinks. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js";
  let file = null;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Squeeze level" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "level", type: "seg", label: "Mode", value: "balanced", options: [
      { v: "light", label: "Light" }, { v: "balanced", label: "Balanced" }, { v: "strong", label: "Strong" } ] }
  ]);
  optHost.append(el("p", { class: "hint", style: "margin-top:12px", text: "Light keeps text as text (gentlest). Balanced and Strong re-render pages as images — biggest savings on scans and photo-heavy files." }));

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", icon: "i-pdf", title: "Drop the PDF to compress",
    hint: "the current size shows up here as a baseline",
    onFiles: (files) => { file = files[0] || null; }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Compress");
  runBtn.dataset.busy = "Compressing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const LEVELS = {
    light:    { rasterize: false },
    balanced: { rasterize: true, dpi: 140, quality: 0.72 },
    strong:   { rasterize: true, dpi: 96,  quality: 0.5 }
  };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file) throw new Error("Drop a PDF first.");
    const before = file.size;
    const cfg = LEVELS[chosen.read().level];
    let blob;

    if (!cfg.rasterize) {
      const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
      const data = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      blob = new Blob([data], { type: "application/pdf" });
      DP.results(out, [{
        name: `${DP.stripExt(file.name)} — compressed.pdf`, blob,
        meta: `${DP.fmtBytes(before)} → ${DP.fmtBytes(blob.size)}`
      }], { title: "Structure optimised" });
      if (blob.size >= before * 0.98) {
        DP.toast("This file was already well optimised — try Balanced or Strong for real savings.", "info", 6000);
      }
      return;
    }

    const src = await pdfjsLib.getDocument({ data: await DP.bytes(file) }).promise;
    const n = src.numPages;
    const prog = DP.progress(out, `Rendering page 1 of ${n}…`);
    const doc = await PDFDocument.create();
    for (let i = 1; i <= n; i++) {
      prog.set((i - 1) / n * 100, `Rendering page ${i} of ${n}…`);
      const page = await src.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = cfg.dpi / 72;
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const jpg = await DP.canvasToBlob(c, "image/jpeg", cfg.quality);
      const img = await doc.embedJpg(await jpg.arrayBuffer());
      const p = doc.addPage([vp1.width, vp1.height]);
      p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
      c.width = c.height = 0; // let the canvas go
    }
    prog.done();
    blob = new Blob([await doc.save()], { type: "application/pdf" });
    if (blob.size >= before) {
      DP.results(out, [{ name: `${DP.stripExt(file.name)} — original.pdf`, blob: file, meta: `${DP.fmtBytes(before)} — already as small as it gets at this level` }],
        { title: "The original was already smaller" });
      DP.toast("Re-rendering didn't beat the original — your file is still here untouched.", "info", 6000);
      return;
    }
    const saved = Math.round((1 - blob.size / before) * 100);
    DP.results(out, [{
      name: `${DP.stripExt(file.name)} — compressed.pdf`, blob,
      meta: `${DP.fmtBytes(before)} → ${DP.fmtBytes(blob.size)} · ${saved}% smaller · ${n} pages`
    }], { title: `${saved}% lighter` });
  }));
})();
