/* Hash Generator — SHA-256, SHA-1, SHA-512 and MD5 for text or a whole file. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "What to hash" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Input", value: "text", options: [
      { v: "text", label: "The text box" }, { v: "file", label: "The dropped file" } ] }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Which one?" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "SHA-256 is the everyday default for checksums and \"did this file change?\" SHA-1 and MD5 are kept for legacy systems and download verifications — fine for catching corruption, not for security. File hashing reads the bytes directly, so it works for videos and archives too." }));
  side.append(note);

  const ta = DP.textArea("Text to hash…", 6);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: "any", compact: true, icon: "i-util",
    title: "…or drop any file", hint: "needed for \"the dropped file\" mode — videos are fine"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Hash it");
  runBtn.dataset.busy = "Hashing…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function binString(bytes) {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return s;
  }
  const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const o = chosen.read();
    let bytes, label;
    if (o.mode === "file") {
      const files = dz.files;
      if (!files.length) throw new Error("Drop a file first (or switch the input mode back to the text box).");
      bytes = await DP.bytes(files[0]);
      label = files[0].name + " — " + DP.fmtBytes(files[0].size);
    } else {
      if (!ta.value) throw new Error("Type some text (or switch the input mode to the dropped file).");
      bytes = new TextEncoder().encode(ta.value);
      label = ta.value.length > 60 ? ta.value.slice(0, 60) + "…" : ta.value;
    }
    const results = [];
    for (const algo of ["SHA-256", "SHA-1", "SHA-512"]) {
      const buf = await crypto.subtle.digest(algo, bytes);
      results.push([algo, toHex(buf), false]);
    }
    results.push(["MD5", md5(binString(bytes)), true]);
    out.textContent = "";
    out.append(el("div", { class: "result-head" }, el("h3", { text: "Fingerprints" }), el("span", { class: "label", text: label })));
    const list = el("div", { class: "results", style: "margin-top:4px" });
    for (const [name, hex, legacy] of results) {
      list.append(el("div", { class: "rcard", style: "align-items:flex-start" },
        el("div", { class: "rcard__body" },
          el("div", { class: "label", text: name + (legacy ? " · legacy, for checksums only" : name === "SHA-1" ? " · legacy, for checksums only" : "") }),
          el("div", { class: "mono", style: "font-size:12.5px;word-break:break-all;margin-top:3px", text: hex })),
        el("div", { class: "rcard__actions" },
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(hex) }, "Copy"))));
    }
    out.append(list);
    out.append(el("div", { class: "btn-row", style: "margin-top:12px" },
      el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(results.map(([n, h]) => n + "  " + h).join("\n"), "hashes.txt") }, "Download all")));
  }));
})();
