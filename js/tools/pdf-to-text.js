/* PDF to Text — pull the text layer out, page by page. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js";
  let file = null, pageCount = 0;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Options" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "pages", type: "text", label: "Pages (optional)", placeholder: "all — or 1-2, 5", value: "" },
    { k: "markers", type: "check", label: "Keep page markers", value: true }
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
        info.querySelector("p").textContent = `${file.name} — ${DP.plural(pageCount, "page")}`;
        info.querySelector("p").style.color = "";
      } catch (e) {
        pageCount = 0;
        info.querySelector("p").textContent = "Couldn't read that file — password-protected or damaged?";
        info.querySelector("p").style.color = "var(--bad)";
      }
    }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Extract text");
  runBtn.dataset.busy = "Reading…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const { pages, markers } = chosen.read();
    const list = pages.trim() ? DP.parseRanges(pages, pageCount) : Array.from({ length: pageCount }, (_, i) => i + 1);
    const doc = await pdfjsLib.getDocument({ data: await DP.bytes(file) }).promise;
    const prog = DP.progress(out, "Starting…");
    const chunks = [];
    let words = 0;
    for (let i = 0; i < list.length; i++) {
      const num = list[i];
      prog.set(i / list.length * 100, `Page ${num} — ${i + 1} of ${list.length}…`);
      const page = await doc.getPage(num);
      const tc = await page.getTextContent();
      let text = "";
      for (const item of tc.items) {
        text += item.str;
        if (item.hasEOL) text += "\n";
        else if (item.str) text += " ";
      }
      text = text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
      words += (text.match(/\S+/g) || []).length;
      chunks.push(markers ? `--- page ${num} ---\n${text}` : text);
    }
    prog.done();
    const full = chunks.join("\n\n");
    out.textContent = "";

    if (!words) {
      out.append(el("div", { class: "err-box" }, "This PDF has no text layer — it's a scan. Use the OCR tool to read it."));
      return;
    }
    const body = el("pre", { class: "tout", text: full });
    const dl = el("button", { class: "btn btn--sm", type: "button" }, "Download .txt");
    dl.addEventListener("click", () => DP.downloadText(full, `${DP.stripExt(file.name)}.txt`));
    out.append(
      el("div", { class: "result-head" },
        el("h3", { text: `Text extracted — ${DP.plural(words, "word")}` }),
        el("span", { class: "label", text: `${list.length} pages` })),
      el("div", { style: "display:grid;gap:12px" },
        body,
        el("div", { class: "btn-row" }, dl, DP.copyButton(full, "Copy all"))));
  }));
})();
