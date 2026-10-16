/* Image Converter — PNG / JPG / WebP / BMP, with quality and a max width. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output settings" }));
  side.append(panel);
  const optHost = el("div");
  panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "format", type: "seg", label: "Format", value: "image/jpeg", options: [
      { v: "image/jpeg", label: "JPG" }, { v: "image/png", label: "PNG" },
      { v: "image/webp", label: "WebP" }, { v: "image/bmp", label: "BMP" } ] },
    { k: "quality", type: "range", label: "Quality", min: 40, max: 100, value: 88, fmt: v => v + "%",
      hint: "Only used by JPG and WebP." },
    { k: "maxw", type: "number", label: "Max width (px)", value: 0, min: 0, step: 1,
      hint: "0 keeps the original size. Height follows proportionally." }
  ]);

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop your images here", hint: "any common format, batch welcome"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/bmp": "bmp" };

  function canvasToBMP(canvas) {
    const ctx = canvas.getContext("2d");
    const { width: w, height: h } = canvas;
    const img = ctx.getImageData(0, 0, w, h).data;
    const rowSize = (w * 3 + 3) & ~3;
    const size = 54 + rowSize * h;
    const buf = new ArrayBuffer(size);
    const dv = new DataView(buf);
    dv.setUint16(0, 0x424D, false); dv.setUint32(2, size, true); dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, rowSize * h, true);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4, dst = 54 + y * rowSize;
      for (let x = 0; x < w; x++) {
        dv.setUint8(dst + x * 3, img[src + x * 4 + 2]);
        dv.setUint8(dst + x * 3 + 1, img[src + x * 4 + 1]);
        dv.setUint8(dst + x * 3 + 2, img[src + x * 4]);
      }
    }
    return new Blob([buf], { type: "image/bmp" });
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image first.");
    const { format, quality, maxw } = chosen.read();
    const items = [];
    for (const f of files) {
      try {
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        const scale = (maxw > 0 && w > maxw) ? maxw / w : 1;
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        const ctx = c.getContext("2d");
        if (format === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(src, 0, 0, c.width, c.height);
        const blob = format === "image/bmp" ? canvasToBMP(c)
          : await DP.canvasToBlob(c, format, format === "image/png" ? undefined : quality / 100);
        const name = `${DP.stripExt(f.name)}.${EXT[format]}`;
        const thumb = await DP.thumbFromBlob(blob);
        items.push({ name, blob, thumb, meta: `${w}×${h} → ${c.width}×${c.height} · ${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}` });
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be converted.");
    DP.results(out, items, { title: items.length === 1 ? "Converted" : `${items.length} images converted`, zipName: "converted-images.zip" });
  }));
})();
