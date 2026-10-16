/* PDF to PNG — lossless page renders at a chosen DPI. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js";
  let file = null, pageCount = 0;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output settings" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "dpi", type: "seg", label: "Sharpness", value: "150", options: [
      { v: "96", label: "96 DPI" }, { v: "150", label: "150 DPI" }, { v: "300", label: "300 DPI" } ] },
    { k: "pages", type: "text", label: "Pages (optional)", placeholder: "all — or 1-2, 5", value: "" }
  ]);
  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "The document" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Waiting for a file…" }));
  side.append(info);

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", icon: "i-pdf", title: "Drop the PDF",
    onFiles: async (files) => {
      file = files[0] || null;
      if (!file) { pageCount = 0; info.querySelector("p").textContent = "Waiting for a file…"; return; }
      try {
        const doc = await pdfjsLib.getDocument({ data: await DP.bytes(file) }).promise;
        pageCount = doc.numPages;
        info.querySelector("p").textContent = `${file.name} — ${DP.plural(pageCount, "page")}, ${DP.fmtBytes(file.size)}`;
        info.querySelector("p").style.color = "";
      } catch (e) {
        pageCount = 0;
        info.querySelector("p").textContent = "Couldn't read that file — password-protected or damaged?";
        info.querySelector("p").style.color = "var(--bad)";
      }
    }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to PNG");
  runBtn.dataset.busy = "Rendering…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const { dpi, pages } = chosen.read();
    const list = pages.trim() ? DP.parseRanges(pages, pageCount) : Array.from({ length: pageCount }, (_, i) => i + 1);
    const doc = await pdfjsLib.getDocument({ data: await DP.bytes(file) }).promise;
    const base = DP.stripExt(file.name);
    const prog = DP.progress(out, "Starting…");
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const num = list[i];
      prog.set(i / list.length * 100, `Page ${num} — ${i + 1} of ${list.length}…`);
      const page = await doc.getPage(num);
      const vp = page.getViewport({ scale: (dpi / 72) });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await DP.canvasToBlob(c, "image/png");
      const name = list.length === 1 ? `${base} — page ${num}.png` : `${base} — page ${String(num).padStart(2, "0")}.png`;
      items.push({ name, blob, thumb: await DP.thumbFromBlob(blob), meta: `${c.width}×${c.height}px · ${DP.fmtBytes(blob.size)}` });
      c.width = c.height = 0;
    }
    prog.done();
    DP.results(out, items, { title: `${DP.plural(items.length, "PNG")} rendered`, zipName: `${base}-png.zip` });
  }));
})();
