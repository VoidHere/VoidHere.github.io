/* Image to Base64 — data URIs and raw base64 for CSS, HTML and API payloads. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output shape" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "shape", type: "seg", label: "Show as", value: "uri", options: [
      { v: "uri", label: "Data URI" }, { v: "raw", label: "Raw base64" }, { v: "css", label: "CSS" } ] },
    { k: "wrap", type: "check", label: "Wrap the long string", value: false,
      hint: "Some tools prefer one endless line; feel free to keep it." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Base64 makes files about a third bigger. Handy for small icons and one-off embeds; painful for photos — keep those as files." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "image/*,.svg",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop images to encode", hint: "PNG, JPG, WebP, SVG… any file type, really"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Encode to base64");
  runBtn.dataset.busy = "Encoding…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const PREVIEW = 200000;

  function toBase64(bytes) {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  const wrapText = (s, n = 76) => s.replace(new RegExp("(.{" + n + "})", "g"), "$1\n");

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const o = chosen.read();
    out.textContent = "";
    const head = el("div", { class: "result-head" }, el("h3", { text: `${DP.plural(files.length, "file")} encoded` }),
      el("span", { class: "label", text: "copy or download below" }));
    out.append(head);
    for (const f of files) {
      const bytes = await DP.bytes(f);
      const b64 = toBase64(bytes);
      const mime = f.type || "application/octet-stream";
      let full = b64, note2 = "";
      if (o.shape === "uri") full = `data:${mime};base64,${b64}`;
      else if (o.shape === "css") full = `background-image: url("data:${mime};base64,${b64}");`;
      if (o.wrap && o.shape !== "css") full = wrapText(full);
      const shown = full.length > PREVIEW ? full.slice(0, PREVIEW) : full;
      if (full.length > PREVIEW) note2 = `preview cut at ${DP.fmtBytes(PREVIEW)} — Copy and Download always use the full ${DP.fmtBytes(full.length)} string`;
      const ta = el("textarea", { class: "input", readonly: "readonly", spellcheck: "false",
        style: "font-family:var(--mono);font-size:11.5px;line-height:1.5;min-height:130px;white-space:pre;resize:vertical" });
      ta.value = shown;
      const card = el("div", { class: "panel", style: "margin-top:14px" },
        el("div", { style: "display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px" },
          el("b", { style: "font-size:14px", text: f.name }),
          el("span", { class: "mono", style: "font-size:12px;color:var(--muted)", text: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(b64.length)} as base64` })),
        ta,
        el("div", { class: "btn-row", style: "margin-top:10px" },
          el("button", { class: "btn btn--sm btn--primary", type: "button", onclick: () => DP.copyText(full) }, "Copy full string"),
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(full, `${DP.stripExt(f.name)}.base64.txt`) }, "Download .txt")),
        note2 ? el("span", { class: "hint", text: note2 }) : null);
      out.append(card);
    }
  }));
})();
