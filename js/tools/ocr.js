/* OCR — pull text out of images and scanned PDFs with a real recognizer. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js";

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Reading" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "lang", type: "select", label: "Language", value: "eng", options: [
      { v: "eng", label: "English" },
      { v: "eng+urd", label: "English + Urdu" },
      { v: "eng+ara", label: "English + Arabic" },
      { v: "eng+hin", label: "English + Hindi" } ] },
    { k: "scale", type: "seg", label: "PDF sharpness", value: "2.5", options: [
      { v: "1.5", label: "Fast" }, { v: "2.5", label: "Balanced" }, { v: "4", label: "Sharp" } ],
      hint: "Higher reads small print better and takes longer." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "The recognizer is the classic Tesseract engine, compiled to WebAssembly — it downloads once (a few MB per language) and then lives in your browser cache. Built for typed text: receipts, scans, screenshots, documents. Handwriting is a coin toss, as it is for every tool of this kind." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "image/*,.pdf,application/pdf",
    multiple: true, icon: "i-eye",
    title: "Drop images or scanned PDFs", hint: "PNG, JPG, WebP, BMP, TIFF-flavoured JPGs… and PDFs"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Read the text");
  runBtn.dataset.busy = "Reading…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  let current = null;

  async function pdfPages(file, scale) {
    const doc = await pdfjsLib.getDocument({ data: await DP.bytes(file) }).promise;
    const canvases = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      canvases.push(c);
    }
    return canvases;
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop an image or a PDF first.");
    const o = chosen.read();
    runBtn.innerHTML = '<span class="spinner"></span>Waking the recognizer…';
    /* tesseract.js spawns a blob worker that importScripts these paths — inside a
       blob worker only absolute URLs are valid, root-relative ones throw. */
    const VENDOR = location.origin + "/vendor/";
    const worker = await Tesseract.createWorker(o.lang, 1, {
      workerPath: VENDOR + "tesseract.worker.min.js",
      corePath: VENDOR,
      langPath: VENDOR,
      logger: (m) => {
        if (m.status === "recognizing text" && current) {
          current.set(Math.round(m.progress * 100), current.label);
        }
      }
    });
    const items = [];
    const texts = [];
    const prog = DP.progress(out, "Starting…");
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const base = DP.stripExt(f.name);
        current = { set: (p, label) => prog.set((i + p / 100) / files.length * 100, label), label: `${f.name} — ${i + 1} of ${files.length}…` };
        try {
          const isPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
          let text = "", confs = [];
          if (isPdf) {
            const canvases = await pdfPages(f, parseFloat(o.scale) || 2.5);
            for (let n = 0; n < canvases.length; n++) {
              current.label = `${f.name} — page ${n + 1} of ${canvases.length}…`;
              current.set(0, current.label);
              const { data } = await worker.recognize(canvases[n]);
              text += (canvases.length > 1 ? `\n\n--- page ${n + 1} ---\n\n` : "") + data.text;
              confs.push(data.confidence || 0);
              canvases[n].width = canvases[n].height = 0;
            }
          } else {
            const { data } = await worker.recognize(f);
            text = data.text;
            confs.push(data.confidence || 0);
          }
          const trimmed = text.trim();
          if (!trimmed) { DP.toast(`"${f.name}" came back empty — try a sharper scan or the Sharp setting.`, "err"); continue; }
          const conf = Math.round(confs.reduce((a, b) => a + b, 0) / Math.max(1, confs.length));
          texts.push(`===== ${f.name} =====\n\n${trimmed}`);
          items.push({
            name: `${base}.txt`,
            blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
            meta: `~${conf}% confident · ${DP.plural(trimmed.split(/\s+/).filter(Boolean).length, "word", "words")}`
          });
        } catch (e) {
          DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
        }
      }
    } finally {
      current = null;
      try { await worker.terminate(); } catch (e) { /* already gone */ }
    }
    prog.done();
    if (!items.length) throw new Error("No readable text came out of those files.");
    DP.results(out, items, { title: `${DP.plural(items.length, "document")} read`, note: "each page's text is inside", zipName: "ocr-text.zip" });
    const all = texts.join("\n\n");
    out.append(el("div", { class: "panel", style: "margin-top:16px" },
      el("span", { class: "label", text: "Preview of everything read" }),
      el("textarea", { class: "input", readonly: "readonly", spellcheck: "false",
        style: "font-family:var(--mono);font-size:12px;line-height:1.6;min-height:200px;margin-top:8px;white-space:pre;resize:vertical" },
        all.length > 40000 ? all.slice(0, 40000) : all),
      el("div", { class: "btn-row", style: "margin-top:10px" },
        el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(all) }, "Copy all text"),
        el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(all, "ocr-everything.txt") }, "Download all .txt"))));
  }));
})();
