/* SVG to PNG — vector in, crisp pixel out at the width you pick. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "width", type: "number", label: "Width (px)", value: 1024, min: 8,
      hint: "Height follows the SVG's own proportions." },
    { k: "bg", type: "seg", label: "Background", value: "none", options: [
      { v: "none", label: "Transparent" }, { v: "#ffffff", label: "White" }, { v: "#141210", label: "Ink" } ] }
  ]);

  const dz = DP.dropzone(app, {
    accept: ".svg,image/svg+xml",
    multiple: true, icon: "i-image",
    title: "Drop SVG files", hint: "They stay vectors on your disk — this only writes the PNG"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Render to PNG");
  runBtn.dataset.busy = "Rendering…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function svgDims(text) {
    let doc;
    try { doc = new DOMParser().parseFromString(text, "image/svg+xml"); }
    catch (e) { return null; }
    const svg = doc.documentElement;
    if (!svg || svg.nodeName !== "svg") return null;
    const rawW = svg.getAttribute("width") || "";
    const rawH = svg.getAttribute("height") || "";
    let W = rawW.endsWith("%") ? NaN : parseFloat(rawW);
    let H = rawH.endsWith("%") ? NaN : parseFloat(rawH);
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if ((!isFinite(W) || !isFinite(H)) && vb.length === 4 && vb.every(n => isFinite(n))) {
      if (!isFinite(W)) W = vb[2];
      if (!isFinite(H)) H = vb[3];
    }
    if (!isFinite(W) || !isFinite(H) || W <= 0 || H <= 0) return null;
    return { W, H };
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one SVG file.");
    const o = chosen.read();
    const tw = Math.max(8, Math.round(o.width) || 1024);
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
        const text = await f.text();
        const dims = svgDims(text);
        if (!dims) throw new Error("no width/viewBox to work from");
        const th = Math.max(1, Math.round(tw * dims.H / dims.W));
        const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
        let img;
        try { img = await DP.loadImage(url); } finally { URL.revokeObjectURL(url); }
        const c = document.createElement("canvas");
        c.width = tw; c.height = th;
        const ctx = c.getContext("2d");
        if (o.bg !== "none") { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, tw, th); }
        ctx.drawImage(img, 0, 0, tw, th);
        const blob = await DP.canvasToBlob(c, "image/png");
        items.push({
          name: `${DP.stripExt(f.name)} — ${tw}px.png`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${tw}×${th}px · ${DP.fmtBytes(blob.size)}`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing could be rendered — are these real SVG files?");
    DP.results(out, items, { title: `${DP.plural(items.length, "PNG")} rendered`, zipName: "svg-png.zip" });
  }));
})();
