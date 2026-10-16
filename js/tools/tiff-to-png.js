/* TIFF to PNG — every page of a TIFF becomes its own PNG. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Multi-page TIFFs — scans, faxes, faxes-that-should-have-been-PDFs — are split page by page. 16-bit and LZW/Deflate/JPEG-compressed TIFFs are handled; CMYK documents are converted to RGB." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: ".tif,.tiff,image/tiff",
    multiple: true, icon: "i-image",
    title: "Drop TIFF files", hint: "Single or multi-page — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to PNG");
  runBtn.dataset.busy = "Decoding TIFF…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop some .tif / .tiff files first.");
    const items = [];
    const prog = DP.progress(out, "Starting…");
    let total = 0, done = 0;
    const counts = [];
    for (const f of files) {
      try {
        const buf = await f.arrayBuffer();
        const ifds = UTIF.decode(buf);
        counts.push({ f, ifds, buf });
        total += ifds.length;
      } catch (e) {
        DP.toast(`Couldn't read "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!total) throw new Error("No TIFF file could be read.");
    for (const { f, ifds, buf } of counts) {
      for (let k = 0; k < ifds.length; k++) {
        const ifd = ifds[k];
        try {
          done++;
          prog.set(done / total * 100, `${f.name}${ifds.length > 1 ? ` — page ${k + 1} of ${ifds.length}` : ""}…`);
          UTIF.decodeImage(buf, ifd);
          const rgba = UTIF.toRGBA8(ifd);
          const w = ifd.width, h = ifd.height;
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), w, h), 0, 0);
          const blob = await DP.canvasToBlob(c, "image/png");
          c.width = c.height = 0;
          const suffix = ifds.length > 1 ? ` — page ${String(k + 1).padStart(2, "0")}` : "";
          items.push({
            name: `${DP.stripExt(f.name)}${suffix}.png`,
            blob, thumb: await DP.thumbFromBlob(blob),
            meta: `${w}×${h}px · ${DP.fmtBytes(blob.size)}`
          });
        } catch (e) {
          DP.toast(`Skipped page ${k + 1} of "${f.name}" — ${e.message}`, "err");
        }
      }
    }
    prog.done();
    if (!items.length) throw new Error("No page could be decoded.");
    DP.results(out, items, { title: `${DP.plural(items.length, "PNG")} from ${DP.plural(files.length, "file")}`, zipName: "tiff-png.zip" });
  }));
})();
