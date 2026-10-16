/* Images to PDF — put JPG/PNG/WebP images onto PDF pages. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Page setup" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "size", type: "seg", label: "Page size", value: "a4", options: [
      { v: "a4", label: "A4" }, { v: "letter", label: "Letter" }, { v: "fit", label: "Fit to image" } ] },
    { k: "margin", type: "range", label: "Margin", min: 0, max: 72, step: 6, value: 24, fmt: v => v + " pt" },
    { k: "mode", type: "seg", label: "Image placement", value: "fit", options: [
      { v: "fit", label: "Fit inside" }, { v: "fill", label: "Fill page" } ] },
    { k: "auto", type: "check", label: "Rotate tall pages to match wide images", value: true }
  ]);

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop your images here", hint: "page order = list order"
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Build the PDF");
  runBtn.dataset.busy = "Building…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

  async function embed(doc, file) {
    const type = (file.type || "").toLowerCase();
    if (type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) return doc.embedJpg(await DP.bytes(file));
    if (type === "image/png" || /\.png$/i.test(file.name)) return doc.embedPng(await DP.bytes(file));
    // WebP / GIF / BMP — rasterise to PNG first
    const src = await DP.imageSource(file);
    const { w, h } = DP.dim(src);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0);
    const blob = await DP.canvasToBlob(c, "image/png");
    return doc.embedPng(await blob.arrayBuffer());
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const { size, margin, mode, auto } = chosen.read();
    const doc = await PDFDocument.create();
    const prog = DP.progress(out, "Stamping pages…");
    for (let i = 0; i < files.length; i++) {
      prog.set(i / files.length * 100, `Image ${i + 1} of ${files.length}…`);
      const img = await embed(doc, files[i]);
      let [pw, ph] = size === "fit"
        ? [img.width + margin * 2, img.height + margin * 2]
        : SIZES[size].slice();
      if (size !== "fit" && auto && img.width > img.height && pw < ph) [pw, ph] = [ph, pw];
      const page = doc.addPage([pw, ph]);
      const box = { w: pw - margin * 2, h: ph - margin * 2 };
      const sx = box.w / img.width, sy = box.h / img.height;
      const s = mode === "fit" ? Math.min(sx, sy) : Math.max(sx, sy);
      const w = img.width * s, h = img.height * s;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    prog.done();
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{
      name: "images.pdf", blob,
      meta: `${files.length} images · ${doc.getPageCount()} pages · ${DP.fmtBytes(blob.size)}`
    }], { title: "PDF ready" });
  }));
})();
