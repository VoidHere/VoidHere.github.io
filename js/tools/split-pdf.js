/* Split PDF — cut one PDF into several, by every page or by ranges. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;
  let pageCount = 0;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "How to split" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Mode", value: "each", options: [
      { v: "each", label: "Every page" }, { v: "ranges", label: "By ranges" } ] },
    { k: "ranges", type: "text", label: "Ranges", placeholder: "1-3, 4, 7-9",
      hint: "Each range becomes one PDF. Commas separate the pieces." }
  ]);
  const info = el("div", { class: "panel" },
    el("span", { class: "label", text: "The document" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Waiting for a file…" }));
  side.append(info);

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", icon: "i-pdf", title: "Drop the PDF to split",
    onFiles: async (files) => {
      if (!files.length) { pageCount = 0; info.querySelector("p").textContent = "Waiting for a file…"; return; }
      try {
        const doc = await PDFDocument.load(await DP.bytes(files[0]), { ignoreEncryption: true });
        pageCount = doc.getPageCount();
        info.querySelector("p").textContent = `${files[0].name} — ${DP.plural(pageCount, "page")}, ${DP.fmtBytes(files[0].size)}`;
        info.querySelector("p").style.color = "";
      } catch (e) {
        pageCount = 0;
        info.querySelector("p").textContent = "Couldn't read that file — password-protected or damaged?";
        info.querySelector("p").style.color = "var(--bad)";
      }
    }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Split it");
  runBtn.dataset.busy = "Splitting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length || !pageCount) throw new Error("Drop a readable PDF first.");
    const src = await PDFDocument.load(await DP.bytes(files[0]), { ignoreEncryption: true });
    const base = DP.stripExt(files[0].name);
    const { mode, ranges } = chosen.read();

    let pieces; // array of {name, indices(0-based)}
    if (mode === "each") {
      pieces = Array.from({ length: pageCount }, (_, i) => ({ name: `${base} — page ${i + 1}.pdf`, indices: [i] }));
    } else {
      const tokens = String(ranges || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!tokens.length) throw new Error("Type the ranges to split by — for example: 1-3, 4, 7-9.");
      pieces = tokens.map(tok => {
        const idx = DP.parseRanges(tok, pageCount).map(p => p - 1);
        return { name: `${base} — pages ${tok}.pdf`, indices: idx };
      });
    }
    if (pieces.length > 60 && mode === "each") {
      // still fine, just a heads-up
      DP.toast("That's a lot of pieces — give it a moment.", "info");
    }

    const items = [];
    for (const piece of pieces) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, piece.indices);
      pages.forEach(p => doc.addPage(p));
      const blob = new Blob([await doc.save()], { type: "application/pdf" });
      items.push({ name: piece.name, blob });
    }
    DP.results(out, items, { title: `${DP.plural(items.length, "file")} ready`, zipName: `${base}-split.zip` });
  }));
})();
