/* Compress Images — quality slider, optional size cap, honest before/after. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Squeeze settings" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "format", type: "seg", label: "Output", value: "keep", options: [
      { v: "keep", label: "Keep format" }, { v: "image/jpeg", label: "JPG" }, { v: "image/webp", label: "WebP" } ] },
    { k: "quality", type: "range", label: "Quality", min: 40, max: 95, value: 80, fmt: v => v + "%",
      hint: "80 is invisible to nearly everyone. 60 shows only on close inspection." },
    { k: "maxw", type: "number", label: "Max width (px)", value: 0, min: 0,
      hint: "0 = keep size. 1920 is plenty for most screens." }
  ]);

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop images to compress", hint: "JPG, PNG and WebP — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Compress");
  runBtn.dataset.busy = "Compressing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const EXT = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const { format, quality, maxw } = chosen.read();
    const items = [];
    let totalBefore = 0, totalAfter = 0;
    for (const f of files) {
      try {
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        const outType = format === "keep" ? (f.type === "image/png" || f.type === "image/webp" ? f.type : "image/jpeg") : format;
        const scale = (maxw > 0 && w > maxw) ? maxw / w : 1;
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        const ctx = c.getContext("2d");
        if (outType === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(src, 0, 0, c.width, c.height);
        const q = outType === "image/png" ? undefined : quality / 100;
        const blob = await DP.canvasToBlob(c, outType, q);
        totalBefore += f.size; totalAfter += blob.size;
        const pct = Math.round((1 - blob.size / f.size) * 100);
        items.push({
          name: `${DP.stripExt(f.name)} — compressed.${EXT[outType]}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)} (${pct >= 0 ? pct + "% smaller" : Math.abs(pct) + "% bigger"})`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be compressed.");
    const saved = Math.round((1 - totalAfter / totalBefore) * 100);
    DP.results(out, items, { title: `${saved}% saved overall`, note: "before → after, per file", zipName: "compressed-images.zip" });
  }));
})();
