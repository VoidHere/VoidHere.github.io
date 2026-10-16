/* Watermark Images — text marks placed where you want them. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The mark" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "text", type: "text", label: "Text", value: "DigitPDF" },
    { k: "pos", type: "select", label: "Placement", value: "br", options: [
      { v: "tl", label: "Top left" }, { v: "tc", label: "Top centre" }, { v: "tr", label: "Top right" },
      { v: "cl", label: "Middle left" }, { v: "cc", label: "Centre" }, { v: "cr", label: "Middle right" },
      { v: "bl", label: "Bottom left" }, { v: "bc", label: "Bottom centre" }, { v: "br", label: "Bottom right" },
      { v: "tile", label: "Tiled across" } ] },
    { k: "size", type: "range", label: "Size", min: 2, max: 20, value: 6, fmt: v => v + "% of width" },
    { k: "opacity", type: "range", label: "Opacity", min: 5, max: 100, value: 55, fmt: v => v + "%" },
    { k: "angle", type: "range", label: "Angle", min: -45, max: 45, value: -30, step: 5, fmt: v => v + "°",
      hint: "Angle only applies to the tiled mark." }
  ]);
  const colorIn = el("input", { type: "color", value: "#ffffff",
    style: "width:100%;height:32px;padding:2px;border:1.5px solid var(--line);border-radius:6px;background:var(--paper);cursor:pointer" });
  panel.append(el("div", { class: "field", style: "margin-top:10px" }, el("span", { class: "label", text: "Ink colour" }), colorIn));

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop images to watermark", hint: "JPG, PNG and WebP — the mark is baked in"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Add watermark");
  runBtn.dataset.busy = "Stamping…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function drawMark(ctx, W, H, o, ink) {
    const size = Math.max(8, W * o.size / 100);
    ctx.font = `700 ${size}px Fraunces, Georgia, serif`;
    ctx.fillStyle = ink;
    ctx.globalAlpha = o.opacity / 100;
    ctx.textBaseline = "middle";
    if (o.pos === "tile") {
      const ang = o.angle * Math.PI / 180;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(ang);
      ctx.textAlign = "center";
      const tw = ctx.measureText(o.text).width;
      const stepX = tw + size * 2.4, stepY = size * 3.6;
      const diag = Math.hypot(W, H);
      for (let y = -diag; y <= diag; y += stepY)
        for (let x = -diag; x <= diag; x += stepX)
          ctx.fillText(o.text, x, y);
      ctx.restore();
      return;
    }
    const pad = Math.round(size * 0.7);
    const vert = { t: "top", c: "middle", b: "bottom" }[o.pos[0]] || "bottom";
    const horiz = { l: "left", c: "center", r: "right" }[o.pos[1]] || "right";
    ctx.textAlign = horiz;
    const x = horiz === "left" ? pad : horiz === "right" ? W - pad : W / 2;
    const y = vert === "top" ? pad + size * 0.6 : vert === "bottom" ? H - pad - size * 0.6 : H / 2;
    ctx.fillText(o.text, x, y);
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const o = chosen.read();
    if (!o.text.trim()) throw new Error("Type the watermark text first.");
    const ink = colorIn.value || "#ffffff";
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        const type = f.type === "image/png" ? "image/png" : (f.type === "image/webp" ? "image/webp" : "image/jpeg");
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(src, 0, 0, w, h);
        drawMark(ctx, w, h, o, ink);
        const blob = await DP.canvasToBlob(c, type, type === "image/png" ? undefined : 0.92);
        const ext = { "image/png": "png", "image/webp": "webp" }[type] || "jpg";
        items.push({
          name: `${DP.stripExt(f.name)} — watermarked.${ext}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${w}×${h} · ${DP.fmtBytes(blob.size)}`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing could be watermarked.");
    DP.results(out, items, { title: `${DP.plural(items.length, "image")} stamped`, zipName: "watermarked-images.zip" });
  }));
})();
