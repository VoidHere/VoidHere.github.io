/* Favicon Generator — one image in, a full icon set out (including a real .ico). */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Icon set" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "fit", type: "seg", label: "Fit", value: "crop", options: [
      { v: "crop", label: "Crop to square" }, { v: "pad", label: "Pad to square" } ] },
    { k: "round", type: "check", label: "Round the corners", value: false,
      hint: "A light 18% corner radius, like modern app icons." }
  ]);
  const colorIn = el("input", { type: "color", value: "#ffffff",
    style: "width:100%;height:32px;padding:2px;border:1.5px solid var(--line);border-radius:6px;background:var(--paper);cursor:pointer" });
  panel.append(el("div", { class: "field", style: "margin-top:10px" },
    el("span", { class: "label", text: "Padding colour" }),
    colorIn,
    el("span", { class: "hint", text: "Only used with \"Pad to square\" — crops keep whatever transparency the image has." })));

  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "Source" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Drop one square-ish image (512px or larger works best)." }));
  side.append(info);

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    icon: "i-image", thumbs: true,
    title: "Drop the master image", hint: "One image — every icon size is generated from it",
    onFiles: async (files) => {
      const p = info.querySelector("p");
      if (!files.length) { p.textContent = "Drop one square-ish image (512px or larger works best)."; return; }
      try {
        const src = await DP.imageSource(files[0]);
        const { w, h } = DP.dim(src);
        p.textContent = `${files[0].name} — ${w}×${h}`;
        if (Math.min(w, h) < 256) p.textContent += " (small — icons may look soft)";
      } catch (e) { p.textContent = "That file isn't readable as an image."; }
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Generate icon set");
  runBtn.dataset.busy = "Drawing icons…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  async function icoFrom(entries) {
    const bufs = [];
    for (const e of entries) bufs.push(new Uint8Array(await e.blob.arrayBuffer()));
    const head = new Uint8Array(6 + 16 * entries.length);
    const dv = new DataView(head.buffer);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, entries.length, true);
    let off = head.length;
    entries.forEach((e, i) => {
      const p = 6 + i * 16;
      head[p] = e.size >= 256 ? 0 : e.size;
      head[p + 1] = e.size >= 256 ? 0 : e.size;
      dv.setUint16(p + 4, 1, true);
      dv.setUint16(p + 6, 32, true);
      dv.setUint32(p + 8, bufs[i].length, true);
      dv.setUint32(p + 12, off, true);
      off += bufs[i].length;
    });
    return new Blob([head, ...bufs], { type: "image/x-icon" });
  }

  function roundedPath(ctx, size, r) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop one image to build the set from.");
    const o = chosen.read();
    const bg = colorIn.value || "#ffffff";
    const src = await DP.imageSource(files[0]);
    const { w, h } = DP.dim(src);
    const SIZES = [16, 32, 48, 180, 192, 512];
    const made = [];
    const prog = DP.progress(out, "Drawing icons…");
    for (let i = 0; i < SIZES.length; i++) {
      const size = SIZES[i];
      prog.set(i / SIZES.length * 100, `${size}×${size}…`);
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.save();
      if (o.round) roundedPath(ctx, size, Math.round(size * 0.18));
      else ctx.beginPath(), ctx.rect(0, 0, size, size);
      ctx.clip();
      if (o.fit === "pad") {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        const s = Math.min(size / w, size / h);
        const dw = w * s, dh = h * s;
        ctx.drawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
      } else {
        const s = Math.max(size / w, size / h);
        const sw = size / s, sh = size / s;
        ctx.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, size, size);
      }
      ctx.restore();
      if (o.round) {
        /* keep corners truly transparent — composite through clip again */
        const c2 = document.createElement("canvas");
        c2.width = size; c2.height = size;
        const x2 = c2.getContext("2d");
        x2.save(); roundedPath(x2, size, Math.round(size * 0.18)); x2.clip();
        x2.drawImage(c, 0, 0);
        x2.restore();
        c.width = c.height = 0;
        c.width = size; c.height = size;
        c.getContext("2d").drawImage(c2, 0, 0);
        c2.width = c2.height = 0;
      }
      const blob = await DP.canvasToBlob(c, "image/png");
      c.width = c.height = 0;
      const name = size === 180 ? "apple-touch-icon.png" : size === 192 ? "android-chrome-192.png" : size === 512 ? "android-chrome-512.png" : `favicon-${size}.png`;
      made.push({ size, blob, name });
    }
    const ico = await icoFrom(made.filter(m => m.size <= 48));
    const manifest = JSON.stringify({
      icons: [
        { src: "android-chrome-192.png", sizes: "192x192", type: "image/png" },
        { src: "android-chrome-512.png", sizes: "512x512", type: "image/png" }
      ]
    }, null, 2);
    prog.done();
    const items = [
      { name: "favicon.ico", blob: ico, meta: "16 + 32 + 48 px — drop-in classic" },
      ...[...made].reverse().map(m => ({ name: m.name, blob: m.blob, meta: `${m.size}×${m.size}px PNG`, thumb: null })),
      { name: "site.webmanifest", blob: new Blob([manifest], { type: "application/manifest+json" }), meta: "references the 192/512 icons" }
    ];
    for (const it of items) if (!it.thumb && it.blob.type === "image/png") it.thumb = await DP.thumbFromBlob(it.blob);
    DP.results(out, items, { title: "Icon set ready", note: "grab the ZIP — everything is in it", zipName: "favicons.zip" });
  }));
})();
