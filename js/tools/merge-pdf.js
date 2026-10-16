/* Merge PDF — combine several PDFs into one, in a chosen order. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;

  side.append(el("div", { class: "panel" },
    el("span", { class: "label", text: "Order matters" }),
    el("p", { style: "font-size:13.5px;color:var(--muted);margin:0" },
      "Files merge top to bottom. New files land at the bottom of the list — use the arrows to move a file up the stack.")));

  const order = [];
  const listHost = el("div", { class: "results", style: "margin-top:16px" });
  const out = el("div");

  function syncOrder(files) {
    const kept = order.filter(f => files.includes(f));
    for (const f of files) if (!kept.includes(f)) kept.push(f);
    order.length = 0; order.push(...kept);
    renderList();
  }

  function renderList() {
    listHost.textContent = "";
    order.forEach((f, i) => {
      const up = el("button", { class: "btn btn--sm", type: "button", "aria-label": "Move up", text: "▲", onclick: () => { if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; renderList(); } } });
      const down = el("button", { class: "btn btn--sm", type: "button", "aria-label": "Move down", text: "▼", onclick: () => { if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; renderList(); } } });
      up.disabled = i === 0; down.disabled = i === order.length - 1;
      listHost.append(el("div", { class: "rcard" },
        el("span", { class: "label", style: "width:26px;text-align:right", text: String(i + 1) }),
        el("div", { class: "rcard__body" },
          el("div", { class: "rcard__name", text: f.name }),
          el("div", { class: "rcard__meta", text: DP.fmtBytes(f.size) })),
        el("div", { class: "rcard__actions" }, up, down)));
    });
  }

  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", multiple: true, icon: "i-pdf",
    title: "Drop two or more PDFs here",
    hint: "they'll be combined on your device",
    onFiles: syncOrder, onEmpty: () => listHost.textContent = ""
  });
  app.append(listHost);
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Merge PDFs");
  runBtn.dataset.busy = "Merging…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (order.length < 2) throw new Error("Add at least two PDFs to merge.");
    const merged = await PDFDocument.create();
    let totalPages = 0;
    for (const f of order) {
      let src;
      try {
        src = await PDFDocument.load(await DP.bytes(f), { ignoreEncryption: true });
      } catch (e) {
        throw new Error(`"${f.name}" couldn't be read — is it password-protected or damaged?`);
      }
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
      totalPages += pages.length;
    }
    const data = await merged.save();
    const blob = new Blob([data], { type: "application/pdf" });
    DP.results(out, [{ name: "merged.pdf", blob, meta: `${order.length} files merged · ${totalPages} pages · ${DP.fmtBytes(blob.size)}` }],
      { title: "Merged and ready", zipName: "merged-pdfs.zip" });
    DP.toast("Done — check your downloads.");
  }));
})();
