/* Rotate PDF — turn pages 90/180/270, all of them or a selection. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument, degrees } = PDFLib;
  let pageCount = 0, file = null;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Rotation" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "turn", type: "seg", label: "Direction", value: "90", options: [
      { v: "90", label: "90° ↻" }, { v: "-90", label: "90° ↺" }, { v: "180", label: "180°" } ] },
    { k: "pages", type: "text", label: "Pages (optional)", placeholder: "all — or 1-3, 7", value: "" }
  ]);
  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "The document" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Waiting for a file…" }));
  side.append(info);

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", icon: "i-pdf", title: "Drop the PDF to turn",
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

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Rotate pages");
  runBtn.dataset.busy = "Rotating…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const { turn, pages } = chosen.read();
    const delta = parseInt(turn, 10);
    const targets = pages.trim() ? DP.parseRanges(pages, pageCount).map(p => p - 1)
                                 : Array.from({ length: pageCount }, (_, i) => i);
    const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
    const all = doc.getPages();
    for (const i of targets) {
      const page = all[i];
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees(((current + delta) % 360 + 360) % 360));
    }
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{
      name: `${DP.stripExt(file.name)} — rotated.pdf`, blob,
      meta: `${delta > 0 ? "+" : ""}${delta}° on ${DP.plural(targets.length, "page")}`
    }], { title: "Turned" });
  }));
})();
