/* Rotate Images — right angles or any custom angle, canvas grows to fit. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Angle" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "turn", type: "seg", label: "Turn", value: "90", options: [
      { v: "90", label: "90° ↻" }, { v: "-90", label: "90° ↺" }, { v: "180", label: "180°" }, { v: "custom", label: "Custom" } ] },
    { k: "angle", type: "range", label: "Custom angle", min: -45, max: 45, value: 5, fmt: v => v + "°",
      hint: "For straightening crooked photos. The canvas grows so nothing is cropped." }
  ]);

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop images to turn", hint: "batch works — same angle for all"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Rotate");
  runBtn.dataset.busy = "Rotating…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const o = chosen.read();
    const deg = o.turn === "custom" ? o.angle : parseInt(o.turn, 10);
    const rad = deg * Math.PI / 180;
    const items = [];
    for (const f of files) {
      try {
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
        const tw = Math.round(w * cos + h * sin);
        const th = Math.round(w * sin + h * cos);
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const ctx = c.getContext("2d");
        const type = f.type === "image/png" ? "image/png" : (f.type === "image/webp" ? "image/webp" : "image/jpeg");
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, tw, th); }
        ctx.translate(tw / 2, th / 2);
        ctx.rotate(rad);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(src, -w / 2, -h / 2);
        const blob = await DP.canvasToBlob(c, type, type === "image/png" ? undefined : 0.92);
        items.push({
          name: `${DP.stripExt(f.name)} — rotated.${DP.getExt(f.name) || "png"}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${deg}° · ${w}×${h} → ${tw}×${th}`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be rotated.");
    DP.results(out, items, { title: `${DP.plural(items.length, "image")} rotated`, zipName: "rotated-images.zip" });
  }));
})();
