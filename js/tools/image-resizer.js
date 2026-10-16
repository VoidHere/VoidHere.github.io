/* Resize Images — exact pixels or percent, aspect ratio respected. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "New size" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Method", value: "px", options: [
      { v: "px", label: "Pixels" }, { v: "pct", label: "Percent" } ] },
    { k: "width", type: "number", label: "Width (px)", value: 1280, min: 1 },
    { k: "height", type: "number", label: "Height (px)", value: 0, min: 0, hint: "0 = work it out from the width." },
    { k: "pct", type: "range", label: "Scale", min: 10, max: 200, value: 50, fmt: v => v + "%" },
    { k: "ratio", type: "check", label: "Keep aspect ratio", value: true }
  ]);
  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "First image" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Drop files to see dimensions." }));
  side.append(info);

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop images to resize",
    onFiles: async (files) => {
      const p = info.querySelector("p");
      if (!files.length) { p.textContent = "Drop files to see dimensions."; return; }
      try {
        const src = await DP.imageSource(files[0]);
        const { w, h } = DP.dim(src);
        p.textContent = `${files[0].name} — ${w}×${h}${files.length > 1 ? ` (+${files.length - 1} more)` : ""}`;
      } catch (e) { p.textContent = "That file isn't readable as an image."; }
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Resize");
  runBtn.dataset.busy = "Resizing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const o = chosen.read();
    const items = [];
    for (const f of files) {
      try {
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        let tw, th;
        if (o.mode === "pct") {
          tw = Math.max(1, Math.round(w * o.pct / 100));
          th = Math.max(1, Math.round(h * o.pct / 100));
        } else {
          if (o.ratio) {
            if (o.width > 0) { tw = Math.round(o.width); th = Math.max(1, Math.round(h * (o.width / w))); }
            else if (o.height > 0) { th = Math.round(o.height); tw = Math.max(1, Math.round(w * (o.height / h))); }
            else throw new Error("Give a width or a height (or both, with ratio off).");
          } else {
            if (!o.width && !o.height) throw new Error("Give a width or a height.");
            tw = o.width || w; th = o.height || h;
          }
        }
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        const type = f.type === "image/png" ? "image/png" : (f.type === "image/webp" ? "image/webp" : "image/jpeg");
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, tw, th); }
        ctx.drawImage(src, 0, 0, tw, th);
        const blob = await DP.canvasToBlob(c, type, type === "image/png" ? undefined : 0.9);
        items.push({
          name: `${DP.stripExt(f.name)} — ${tw}x${th}.${DP.getExt(f.name) || "png"}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${w}×${h} → ${tw}×${th} · ${DP.fmtBytes(blob.size)}`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be resized.");
    DP.results(out, items, { title: `${DP.plural(items.length, "image")} resized`, zipName: "resized-images.zip" });
  }));
})();
