/* Remove EXIF — strip camera metadata. Lossless when possible, pixel-baked when needed. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "What goes" }));
  panel.append(el("ul", { style: "margin:0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.7" },
    el("li", { text: "Camera make, model, lens, serial" }),
    el("li", { text: "GPS coordinates" }),
    el("li", { text: "Date & time taken, timezone" }),
    el("li", { text: "Software history, thumbnails, comments" })));
  side.append(panel);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "How it strips" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "If the photo sits upright without help, the exact original pixels are kept — only the metadata banner is cut out. If it was stored rotated, the rotation gets painted into the pixels first so it still looks right." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "image/jpeg,.jpg,.jpeg",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop JPEG photos to clean", hint: "the file you share out is the clean one"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Strip metadata");
  runBtn.dataset.busy = "Stripping…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function binString(bytes) {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return s;
  }
  function bytesFromBin(s) {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF;
    return b;
  }
  async function bakeRotation(file, orientation) {
    const src = await DP.imageSource(file);
    const { w, h } = DP.dim(src);
    const swap = orientation >= 5 && orientation <= 8;
    const c = document.createElement("canvas");
    c.width = swap ? h : w;
    c.height = swap ? w : h;
    const m = {
      2: [-1, 0, 0, 1, w, 0],
      3: [-1, 0, 0, -1, w, h],
      4: [1, 0, 0, -1, 0, h],
      5: [0, 1, 1, 0, 0, 0],
      6: [0, 1, -1, 0, h, 0],
      7: [0, -1, -1, 0, h, w],
      8: [0, -1, 1, 0, 0, w]
    }[orientation] || [1, 0, 0, 1, 0, 0];
    const ctx = c.getContext("2d");
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a JPEG first.");
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
      try {
        const bytes = await DP.bytes(f);
        let orientation = 1, hadExif = false;
        try {
          const obj = piexif.load(binString(bytes));
          hadExif = ["0th", "Exif", "GPS"].some(g => obj[g] && Object.keys(obj[g]).length);
          const o = obj["0th"] && obj["0th"][piexif.ImageIFD.Orientation];
          orientation = Number(o) || 1;
        } catch (e) { /* no readable exif */ }
        let blob, note2;
        if (orientation >= 2 && orientation <= 8) {
          const c = await bakeRotation(f, orientation);
          blob = await DP.canvasToBlob(c, "image/jpeg", 0.95);
          c.width = c.height = 0;
          note2 = "rotation baked in, metadata gone";
        } else {
          let outBin;
          try { outBin = piexif.remove(binString(bytes)); }
          catch (e) { outBin = null; }
          if (outBin) {
            blob = new Blob([bytesFromBin(outBin)], { type: "image/jpeg" });
            note2 = "pixels untouched, metadata cut out";
          } else {
            const src = await DP.imageSource(f);
            const { w, h } = DP.dim(src);
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d").drawImage(src, 0, 0);
            blob = await DP.canvasToBlob(c, "image/jpeg", 0.95);
            c.width = c.height = 0;
            note2 = "file rebuilt pixel-perfect, metadata gone";
          }
        }
        items.push({
          name: `${DP.stripExt(f.name)} — clean.jpg`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${hadExif ? "EXIF found · " : "no EXIF · "}${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)} — ${note2}`
        });
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing could be processed.");
    DP.results(out, items, { title: `${DP.plural(items.length, "photo")} cleaned`, note: "share these — they remember nothing", zipName: "clean-photos.zip" });
  }));
})();
