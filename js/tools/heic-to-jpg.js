/* HEIC to JPG — decode iPhone photos locally and hand back normal images. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "format", type: "seg", label: "Convert to", value: "image/jpeg", options: [
      { v: "image/jpeg", label: "JPG" }, { v: "image/png", label: "PNG" } ] },
    { k: "quality", type: "range", label: "JPG quality", min: 70, max: 98, value: 92, fmt: v => v + "%" }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Live Photos hand over only their still frame; bursts come out as one image per frame. Everything is decoded on your machine — the decoder is a 1.3 MB script that only loads on this page." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: ".heic,.heif,image/heic,image/heif",
    multiple: true, icon: "i-image",
    title: "Drop HEIC / HEIF photos", hint: "Straight from an iPhone or iPad — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Decoding HEIC…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop some .heic files first.");
    const o = chosen.read();
    const ext = o.format === "image/png" ? "png" : "jpg";
    const items = [];
    const failed = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
        const res = await heic2any({ blob: f, toType: o.format, quality: o.quality / 100 });
        const blobs = Array.isArray(res) ? res : [res];
        for (let k = 0; k < blobs.length; k++) {
          const blob = blobs[k];
          const suffix = blobs.length > 1 ? ` — frame ${k + 1}` : "";
          items.push({
            name: `${DP.stripExt(f.name)}${suffix}.${ext}`,
            blob, thumb: await DP.thumbFromBlob(blob),
            meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}`
          });
        }
      } catch (e) {
        failed.push(f.name);
        DP.toast(`Couldn't decode "${f.name}" — ${e.message || "unknown error"}`, "err");
      }
    }
    prog.done();
    if (!items.length) throw new Error(failed.length ? "No HEIC file could be decoded — are these really .heic files?" : "Nothing could be converted.");
    DP.results(out, items, { title: `${DP.plural(items.length, "photo")} converted`, zipName: "converted-heic.zip" });
  }));
})();
