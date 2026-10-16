/* Page Numbers PDF — position, start number and format, exactly where you want them. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  let file = null, pageCount = 0;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Numbering" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "pos", type: "select", label: "Position", value: "bottom-center", options: [
      { v: "bottom-left", label: "Bottom left" }, { v: "bottom-center", label: "Bottom centre" }, { v: "bottom-right", label: "Bottom right" },
      { v: "top-left", label: "Top left" }, { v: "top-center", label: "Top centre" }, { v: "top-right", label: "Top right" } ] },
    { k: "style", type: "seg", label: "Format", value: "plain", options: [
      { v: "plain", label: "1" }, { v: "page", label: "Page 1" }, { v: "of", label: "1 of N" } ] },
    { k: "start", type: "number", label: "First number", value: 1, min: 0, step: 1 },
    { k: "size", type: "seg", label: "Text size", value: "10", options: [
      { v: "9", label: "9 pt" }, { v: "10", label: "10 pt" }, { v: "12", label: "12 pt" } ] },
    { k: "pages", type: "text", label: "Pages (optional)", placeholder: "all — or 2-10", value: "" }
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
        const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
        pageCount = doc.getPageCount();
        info.querySelector("p").textContent = `${file.name} — ${DP.plural(pageCount, "page")}`;
        info.querySelector("p").style.color = "";
      } catch (e) {
        pageCount = 0;
        info.querySelector("p").textContent = "Couldn't read that file — password-protected or damaged?";
        info.querySelector("p").style.color = "var(--bad)";
      }
    }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Add page numbers");
  runBtn.dataset.busy = "Numbering…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const o = chosen.read();
    const targets = o.pages.trim() ? DP.parseRanges(o.pages, pageCount).map(p => p - 1)
                                   : Array.from({ length: pageCount }, (_, i) => i);
    const total = targets.length;
    const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = parseInt(o.size, 10);
    const pages = doc.getPages();
    const margin = 30;
    targets.forEach((pi, k) => {
      const page = pages[pi];
      const { width, height } = page.getSize();
      const n = o.start + k;
      const label = o.style === "plain" ? String(n)
                  : o.style === "page" ? `Page ${n}`
                  : `${n} of ${o.start + total - 1}`;
      const tw = font.widthOfTextAtSize(label, size);
      const bottom = o.pos.startsWith("bottom");
      const y = bottom ? margin : height - margin - size;
      let x;
      if (o.pos.endsWith("left")) x = margin;
      else if (o.pos.endsWith("right")) x = width - margin - tw;
      else x = width / 2 - tw / 2;
      page.drawText(label, { x, y, size, font, color: rgb(0.15, 0.15, 0.15) });
    });
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{
      name: `${DP.stripExt(file.name)} — numbered.pdf`, blob,
      meta: `${total} pages numbered, starting at ${o.start}`
    }], { title: "Done" });
  }));
})();
