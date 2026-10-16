/* Base64 for Text — UTF-8 safe, both directions, URL-safe on request. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Direction" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "dir", type: "seg", label: "Convert", value: "enc", options: [
      { v: "enc", label: "Text → Base64" }, { v: "dec", label: "Base64 → Text" } ] },
    { k: "url", type: "check", label: "URL-safe alphabet (+/ → -_)", value: false,
      hint: "For filenames, tokens and query strings." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Emoji and accents survive — the text is encoded as UTF-8 first, which is exactly what browsers and APIs expect. Decoding is lenient: stray spaces, tabs and line breaks get ignored." }));
  side.append(note);

  const ta = DP.textArea("Type or paste here…", 9);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: ".txt,text/plain", compact: true, icon: "i-text",
    title: "…or drop a text file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) ta.value = await files[0].text(); }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const toB64 = (bytes) => {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste some text first.");
    const o = chosen.read();
    if (o.dir === "enc") {
      let b64 = toB64(new TextEncoder().encode(src));
      if (o.url) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      DP.textResult(out, {
        title: "Encoded",
        text: b64,
        filename: "encoded.txt",
        meta: `${DP.fmtBytes(src.length)} text → ${DP.fmtBytes(b64.length)} base64${o.url ? " · URL-safe" : ""}`
      });
    } else {
      let clean = src.replace(/\s+/g, "");
      if (o.url) clean = clean.replace(/-/g, "+").replace(/_/g, "/");
      const pad = clean.length % 4;
      if (pad === 2) clean += "==";
      else if (pad === 3) clean += "=";
      else if (pad === 1) throw new Error("That base64 looks cut short — one character too few.");
      let bytes;
      try {
        const bin = atob(clean);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch (e) {
        throw new Error("That isn't valid base64 — check for stray characters.");
      }
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const lossy = text.includes("\uFFFD") && !src.includes("\uFFFD");
      DP.textResult(out, {
        title: "Decoded",
        text,
        filename: "decoded.txt",
        meta: `${DP.fmtBytes(src.length)} base64 → ${DP.fmtBytes(text.length)} text${lossy ? " · some bytes weren't UTF-8 text" : ""}`
      });
    }
  }));
})();
