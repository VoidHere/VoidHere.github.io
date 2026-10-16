/* Reorder PDF Pages — type the new page sequence; get the rearranged file. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;
  let pageCount = 0, file = null;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The new order" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "order", type: "text", label: "Page sequence", placeholder: "e.g. 3,1,2,4,5",
      hint: "Every page must appear exactly once. Handy shortcut: reverse with e.g. 5,4,3,2,1." }
  ]);
  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "The document" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Waiting for a file…" }));
  side.append(info);

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", icon: "i-pdf", title: "Drop the PDF to rearrange",
    onFiles: async (files) => {
      file = files[0] || null;
      if (!file) { pageCount = 0; info.querySelector("p").textContent = "Waiting for a file…"; return; }
      try {
        const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
        pageCount = doc.getPageCount();
        info.querySelector("p").textContent = `${file.name} — ${DP.plural(pageCount, "page")}. Try: ${Array.from({length: pageCount}, (_,i)=>i+1).reverse().join(",")}`;
        info.querySelector("p").style.color = "";
      } catch (e) {
        pageCount = 0;
        info.querySelector("p").textContent = "Couldn't read that file — password-protected or damaged?";
        info.querySelector("p").style.color = "var(--bad)";
      }
    }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Rearrange");
  runBtn.dataset.busy = "Rearranging…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const { order } = chosen.read();
    const seq = DP.parseRanges(order, pageCount);
    const uniq = new Set(seq);
    if (uniq.size !== pageCount || seq.length !== pageCount) {
      throw new Error(`A ${pageCount}-page file needs all ${pageCount} pages listed once each — you gave ${seq.length} entries (${uniq.size} unique).`);
    }
    const src = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
    const doc = await PDFDocument.create();
    const copied = await doc.copyPages(src, seq.map(p => p - 1));
    copied.forEach(p => doc.addPage(p));
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{ name: `${DP.stripExt(file.name)} — reordered.pdf`, blob, meta: `${pageCount} pages in your order` }],
      { title: "Reordered" });
  }));
})();
