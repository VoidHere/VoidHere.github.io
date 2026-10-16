/* Delete PDF Pages — remove selected pages, keep the rest. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;
  let pageCount = 0, file = null;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Pages to delete" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "pages", type: "text", label: "Remove", placeholder: "1, 4, 7-9",
      hint: "Everything not listed here stays in the file." }
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

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Remove pages");
  runBtn.dataset.busy = "Removing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const { pages } = chosen.read();
    const drop = new Set(DP.parseRanges(pages, pageCount));
    if (drop.size >= pageCount) throw new Error("That would remove every page — a PDF needs at least one.");
    const keep = [];
    for (let p = 1; p <= pageCount; p++) if (!drop.has(p)) keep.push(p - 1);
    const src = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
    const doc = await PDFDocument.create();
    const copied = await doc.copyPages(src, keep);
    copied.forEach(p => doc.addPage(p));
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{
      name: `${DP.stripExt(file.name)} — cleaned.pdf`, blob,
      meta: `${drop.size} removed · ${keep.length} kept · ${DP.fmtBytes(blob.size)}`
    }], { title: "Cleaned up" });
  }));
})();
