/* QR Code Generator — crisp PNG and SVG, ready to print or embed. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The code" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "ecc", type: "seg", label: "Error correction", value: "M", options: [
      { v: "L", label: "L — 7%" }, { v: "M", label: "M — 15%" }, { v: "Q", label: "Q — 25%" }, { v: "H", label: "H — 30%" } ],
      hint: "More correction = denser code that survives scuffs. H is for stickers and print." },
    { k: "cell", type: "range", label: "Module size (PNG)", min: 2, max: 16, value: 8, fmt: v => v + " px" },
    { k: "margin", type: "range", label: "Quiet zone", min: 0, max: 8, value: 4, fmt: v => v + " modules",
      hint: "The white breathing room scanners need. 4 is the standard." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Links, plain text, WiFi strings (WIFI:T:WPA;S:name;P:pass;;), vCards, phone numbers — anything up to a few hundred characters. Made offline with a textbook QR encoder; the SVG version stays sharp at billboard sizes." }));
  side.append(note);

  const ta = DP.textArea("Type the link or text to encode…", 5);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Make the QR code");
  runBtn.dataset.busy = "Drawing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const text = ta.value.trim();
    if (!text) throw new Error("Type something to encode first.");
    const o = chosen.read();
    let qr;
    try {
      qr = qrcode(0, o.ecc);
      qr.addData(text);
      qr.make();
    } catch (e) {
      throw new Error("That text is too long for a QR code at this correction level — try level L or less text.");
    }
    const size = qr.getModuleCount();
    const dataUrl = qr.createDataURL(o.cell, o.margin);
    const svgTag = qr.createSvgTag(o.cell, o.margin);
    out.textContent = "";
    out.append(el("div", { class: "result-head" },
      el("h3", { text: "Scannable" }),
      el("span", { class: "label", text: `${size}×${size} modules · level ${o.ecc} · version ${Math.ceil((size - 17) / 4)}` })));
    const prev = el("div", { class: "panel", style: "margin-top:12px;display:flex;justify-content:center;background:#fff" });
    prev.append(el("img", { src: dataUrl, alt: "QR code", style: "width:min(320px, 70vw);height:auto;image-rendering:pixelated" }));
    out.append(prev);
    const pngName = "qr-code.png", svgName = "qr-code.svg";
    out.append(el("div", { class: "btn-row", style: "margin-top:12px" },
      el("button", { class: "btn btn--sm btn--primary", type: "button", onclick: () => DP.downloadURL(dataUrl, pngName, "image/png") }, "Download PNG"),
      el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(svgTag, svgName, "image/svg+xml") }, "Download SVG"),
      el("button", { class: "btn btn--sm", type: "button", onclick: async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          DP.toast("QR code copied — paste it anywhere.");
        } catch (e) { DP.toast("This browser wouldn't let us use the clipboard — use Download instead.", "err"); }
      } }, "Copy image")));
  }));
})();
