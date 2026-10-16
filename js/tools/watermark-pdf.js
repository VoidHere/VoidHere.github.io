/* Watermark PDF — a text stamp across the pages. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
  let file = null, pageCount = 0;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The stamp" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "text", type: "text", label: "Watermark text", value: "CONFIDENTIAL" },
    { k: "size", type: "range", label: "Text size", min: 18, max: 120, step: 2, value: 56, fmt: v => v + " pt" },
    { k: "opacity", type: "range", label: "Opacity", min: 4, max: 60, value: 14, fmt: v => v + "%" },
    { k: "angle", type: "range", label: "Angle", min: 0, max: 90, value: 40, fmt: v => v + "°" },
    { k: "color", type: "seg", label: "Ink", value: "red", options: [
      { v: "red", label: "Red" }, { v: "grey", label: "Grey" }, { v: "blue", label: "Blue" }, { v: "black", label: "Black" } ] },
    { k: "pages", type: "text", label: "Pages (optional)", placeholder: "all — or 1-3, 7", value: "" }
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

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Stamp it");
  runBtn.dataset.busy = "Stamping…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const INK = { red: rgb(0.78, 0.16, 0.10), grey: rgb(0.45, 0.45, 0.45), blue: rgb(0.16, 0.30, 0.65), black: rgb(0.05, 0.05, 0.05) };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const o = chosen.read();
    if (!o.text.trim()) throw new Error("Type the watermark text first.");
    const targets = o.pages.trim() ? DP.parseRanges(o.pages, pageCount).map(p => p - 1)
                                   : Array.from({ length: pageCount }, (_, i) => i);
    const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();
    for (const i of targets) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const tw = font.widthOfTextAtSize(o.text, o.size);
      const rad = o.angle * Math.PI / 180;
      const x = width / 2 - (tw / 2) * Math.cos(rad) + (o.size / 2) * Math.sin(rad);
      const y = height / 2 - (tw / 2) * Math.sin(rad) - (o.size / 2) * Math.cos(rad);
      page.drawText(o.text, {
        x, y, size: o.size, font, color: INK[o.color],
        opacity: o.opacity / 100, rotate: degrees(o.angle)
      });
    }
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{
      name: `${DP.stripExt(file.name)} — watermarked.pdf`, blob,
      meta: `“${o.text}” on ${DP.plural(targets.length, "page")}`
    }], { title: "Stamped" });
  }));
})();
