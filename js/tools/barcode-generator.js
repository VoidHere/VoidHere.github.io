/* Barcode Generator — the everyday formats, drawn as sharp vectors. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The barcode" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "format", type: "select", label: "Format", value: "CODE128", options: [
      { v: "CODE128", label: "CODE 128 — anything goes" },
      { v: "EAN13", label: "EAN-13 — retail products" },
      { v: "EAN8", label: "EAN-8 — small retail" },
      { v: "UPC", label: "UPC-A — US retail" },
      { v: "CODE39", label: "CODE 39 — industrial" },
      { v: "ITF14", label: "ITF-14 — cartons" },
      { v: "MSI", label: "MSI — inventory" } ] },
    { k: "width", type: "range", label: "Bar width", min: 1, max: 4, value: 2, fmt: v => v + " px" },
    { k: "height", type: "range", label: "Height", min: 30, max: 160, value: 80, step: 5, fmt: v => v + " px" },
    { k: "value", type: "check", label: "Show the digits under the bars", value: true }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Format rules" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "EAN-13 wants 12 or 13 digits (we'll compute the check digit if you give 12). UPC wants 11 or 12, EAN-8 wants 7 or 8, ITF-14 wants 13 or 14. CODE 128 takes letters, numbers and common symbols — the safe default." }));
  side.append(note);

  const ta = DP.textArea("Type the value to encode — numbers, or letters for CODE 128 / 39…", 4);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Draw the barcode");
  runBtn.dataset.busy = "Drawing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const value = ta.value.trim();
    if (!value) throw new Error("Type a value first.");
    const o = chosen.read();
    /* render an SVG in-page, then screenshot it to canvas for the PNG */
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    try {
      JsBarcode(svg, value, { format: o.format, width: o.width, height: o.height, displayValue: o.value, margin: 10, background: "#ffffff", lineColor: "#111111" });
    } catch (e) {
      throw new Error((e && e.message ? e.message : "That value doesn't fit the format") + " — for " + o.format + ". " + (o.format.startsWith("EAN") || o.format === "UPC" ? "Give the digits, e.g. 12 or 13 of them for EAN-13." : "Try CODE 128 for mixed text."));
    }
    const svgText = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    let pngBlob = null;
    try {
      const img = await DP.loadImage(url);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 600;
      c.height = img.naturalHeight || 200;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      pngBlob = await DP.canvasToBlob(c, "image/png");
      c.width = c.height = 0;
    } catch (e) { /* PNG export hiccup — SVG still fine */ }
    URL.revokeObjectURL(url);

    out.textContent = "";
    out.append(el("div", { class: "result-head" },
      el("h3", { text: "Printable" }),
      el("span", { class: "label", text: o.format + " · " + value.length + " characters" })));
    const prev = el("div", { class: "panel", style: "margin-top:12px;display:flex;justify-content:center;background:#fff;overflow:auto" });
    prev.innerHTML = svgText;
    const svgEl = prev.querySelector("svg");
    if (svgEl) { svgEl.style.maxWidth = "100%"; svgEl.style.height = "auto"; }
    out.append(prev);
    const row = el("div", { class: "btn-row", style: "margin-top:12px" });
    if (pngBlob) {
      row.append(el("button", { class: "btn btn--sm btn--primary", type: "button",
        onclick: () => DP.download(pngBlob, "barcode.png") }, "Download PNG"));
    }
    row.append(el("button", { class: "btn btn--sm", type: "button",
      onclick: () => DP.downloadText(svgText, "barcode.svg", "image/svg+xml") }, "Download SVG"));
    out.append(row);
  }));
})();
