/* Base64 to Image — paste a data URI (or raw base64) and get the picture back. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Works with a full data: URI, a bare base64 blob, or a text file full of them. If it's an image type we recognise, we name the file for you. The bytes are sniffed, not guessed blindly." }));
  side.append(note);

  const ta = el("textarea", { class: "input", spellcheck: "false",
    placeholder: "Paste a data: URI like  data:image/png;base64,iVBORw0KGgo…  — or raw base64 — or drop a .txt file below.",
    style: "font-family:var(--mono);font-size:12.5px;line-height:1.55;min-height:150px;margin-top:18px;resize:vertical" });
  app.append(ta);

  const dz = DP.dropzone(app, {
    accept: ".txt,text/plain",
    compact: true, icon: "i-text",
    title: "…or drop a text file", hint: "the first line is used",
    onFiles: async (files) => {
      if (files.length) ta.value = (await files[0].text()).trim();
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Decode to image");
  runBtn.dataset.busy = "Decoding…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function sniff(bytes) {
    const b = bytes;
    if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { mime: "image/png", ext: "png" };
    if (b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { mime: "image/jpeg", ext: "jpg" };
    if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: "image/gif", ext: "gif" };
    if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
    if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4D) return { mime: "image/bmp", ext: "bmp" };
    const head = new TextDecoder().decode(b.slice(0, 256)).trimStart().toLowerCase();
    if (head.startsWith("<svg") || head.startsWith("<?xml")) return { mime: "image/svg+xml", ext: "svg" };
    return { mime: "application/octet-stream", ext: "bin" };
  }
  function b64ToBytes(b64) {
    const clean = b64.replace(/\s+/g, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const text = ta.value.trim();
    if (!text) throw new Error("Paste some base64 (or drop a .txt file) first.");
    const chunks = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && l.startsWith("data:"));
    if (lines.length > 1) chunks.push(...lines);
    else chunks.push(text.replace(/\r?\n/g, ""));
    const items = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let mime = null, b64 = chunk;
      const m = chunk.match(/^data:([\w/+.-]+);base64,(.*)$/s);
      if (m) { mime = m[1]; b64 = m[2]; }
      let bytes;
      try { bytes = b64ToBytes(b64); }
      catch (e) { throw new Error(chunks.length > 1 ? `Line ${i + 1} isn't valid base64.` : "That isn't valid base64 — check for missing characters."); }
      if (!bytes.length) throw new Error("Decoded to zero bytes — is the string complete?");
      const guess = sniff(bytes);
      const type = mime || guess.mime;
      const ext = mime && mime.startsWith("image/") ? mime.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg") : guess.ext;
      const blob = new Blob([bytes], { type });
      items.push({
        name: `decoded${chunks.length > 1 ? "-" + (i + 1) : ""}.${ext}`,
        blob, thumb: await DP.thumbFromBlob(blob),
        meta: `${DP.fmtBytes(bytes.length)} · ${type}`
      });
    }
    DP.results(out, items, { title: items.length === 1 ? "Image decoded" : `${items.length} images decoded`, zipName: "decoded-base64.zip" });
  }));
})();
