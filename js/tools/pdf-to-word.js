/* PDF to Word — text into an editable .docx, built by hand, page by page. */
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
    { k: "markers", type: "check", label: "Keep “— page N —” markers", value: true }
  ]);
  panel.append(el("p", { class: "hint", style: "margin-top:12px",
    text: "This is an honest text conversion: words and paragraphs, real page breaks. Formatting, columns and images are not reproduced — that needs a desktop office suite." }));
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

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to Word");
  runBtn.dataset.busy = "Building the document…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const xesc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                       .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
                       .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  function para(text) {
    return `<w:p><w:r><w:t xml:space="preserve">${xesc(text)}</w:t></w:r></w:p>`;
  }
  const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  function buildDocx(pagesText, markers) {
    const body = [];
    pagesText.forEach((text, i) => {
      if (i > 0) body.push(PAGE_BREAK);
      if (markers) body.push(para(`— page ${i + 1} —`));
      for (const line of text.split("\n")) {
        if (line.trim()) body.push(para(line.trim()));
      }
    });
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      body.join("") +
      `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr>` +
      `</w:body></w:document>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`;
    return { docXml, contentTypes, rels };
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file || !pageCount) throw new Error("Drop a readable PDF first.");
    const JSZip = await DP.lib("jszip.min.js");
    const { markers } = chosen.read();
    const doc = await pdfjsLib.getDocument({ data: await DP.bytes(file) }).promise;
    const prog = DP.progress(out, "Reading pages…");
    const pagesText = [];
    let words = 0;
    for (let n = 1; n <= pageCount; n++) {
      prog.set((n - 1) / pageCount * 100, `Page ${n} of ${pageCount}…`);
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      let text = "";
      for (const item of tc.items) {
        text += item.str;
        text += item.hasEOL ? "\n" : (item.str ? " " : "");
      }
      text = text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
      words += (text.match(/\S+/g) || []).length;
      pagesText.push(text);
    }
    prog.done();
    if (!words) throw new Error("No text layer found — this is a scan. Run it through the OCR tool first.");

    const { docXml, contentTypes, rels } = buildDocx(pagesText, markers);
    const zip = new JSZip();
    zip.file("[Content_Types].xml", contentTypes);
    zip.folder("_rels").file(".rels", rels);
    zip.folder("word").file("document.xml", docXml);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    DP.results(out, [{
      name: `${DP.stripExt(file.name)}.docx`, blob,
      meta: `${DP.plural(words, "word")} · ${pageCount} pages · text-only conversion`
    }], { title: "Word document ready" });
    if (words < 10) DP.toast("Barely any text found — the PDF is probably a scan.", "info");
  }));
})();
