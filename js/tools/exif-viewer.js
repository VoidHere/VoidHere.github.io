/* EXIF Viewer — read what a camera wrote into a photo, without uploading it. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Cameras record far more than most people expect — the exact body and lens, shooting settings, sometimes software history, and coordinates when the phone had GPS on. Seeing it is the first step to deciding what to strip." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "image/jpeg,.jpg,.jpeg",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop JPEG photos to inspect", hint: "a photo straight off the camera is ideal"
  });

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  function binString(bytes) {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return s;
  }
  function readable(tag, val) {
    try {
      if (tag === "0th" || tag === "Exif" || tag === "GPS" || tag === "Interop" || tag === "1st") { /* noop */ }
      if (Array.isArray(val)) {
        if (val.length && Array.isArray(val[0]) && val[0].length === 2) {
          return val.map(p => (p[0] / p[1]).toFixed(p[1] > 10 ? 6 : 2).replace(/\.?0+$/, "")).join(", ");
        }
        return val.join(" ");
      }
      return String(val);
    } catch (e) { return String(val); }
  }
  function gpsDecimal(exifObj) {
    try {
      const g = exifObj.GPS || {};
      if (!g[2] || !g[4]) return null;
      const toDeg = (v) => v[0][0] / v[0][1] + v[1][0] / v[1][1] / 60 + v[2][0] / v[2][1] / 3600;
      let lat = toDeg(g[2]), lon = toDeg(g[4]);
      if (String(g[1] || "N").toUpperCase().startsWith("S")) lat = -lat;
      if (String(g[3] || "E").toUpperCase().startsWith("W")) lon = -lon;
      return { lat, lon };
    } catch (e) { return null; }
  }
  const GROUP_LABEL = { "0th": "Image", "Exif": "Camera & exposure", "GPS": "Location", "Interop": "Interop", "1st": "Thumbnail" };

  function renderOne(host, f, exifObj) {
    const head = el("div", { class: "result-head" },
      el("h3", { text: f.name }),
      el("span", { class: "label", text: `${DP.fmtBytes(f.size)}${exifObj ? "" : " · no EXIF"}` }));
    host.append(head);
    if (!exifObj) {
      host.append(el("div", { class: "empty", style: "margin-top:8px", text: "No EXIF banner in this file — it's already as clean as a photo gets. (PNG and most WebP files never carry camera EXIF.)" }));
      return;
    }
    const coords = gpsDecimal(exifObj);
    if (coords) {
      const map = `https://www.openstreetmap.org/?mlat=${coords.lat.toFixed(6)}&mlon=${coords.lon.toFixed(6)}#map=15/${coords.lat.toFixed(6)}/${coords.lon.toFixed(6)}`;
      host.append(el("div", { class: "panel", style: "margin-top:10px;border-color:var(--accent)" },
        el("span", { class: "label", text: "This photo knows where it was taken" }),
        el("p", { class: "mono", style: "margin:0 0 8px;font-size:14px", text: `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}` }),
        el("a", { class: "btn btn--sm", href: map, target: "_blank", rel: "noopener noreferrer" }, "Show on OpenStreetMap")));
    }
    for (const g of ["0th", "Exif", "GPS", "Interop"]) {
      const group = exifObj[g];
      if (!group || !Object.keys(group).length) continue;
      const tbl = el("table", { style: "width:100%;border-collapse:collapse;margin-top:8px;font-size:13px" });
      for (const k of Object.keys(group)) {
        const def = (piexif.TAGS[g] || {})[k];
        const name = def ? def.name : `Tag ${k}`;
        const val = readable(g, group[k]);
        if (val === "" || val == null) continue;
        tbl.append(el("tr", {},
          el("td", { style: "padding:5px 14px 5px 0;vertical-align:top;color:var(--muted);white-space:nowrap;border-top:1px solid var(--line)", text: name }),
          el("td", { class: "mono", style: "padding:5px 0;vertical-align:top;word-break:break-word;border-top:1px solid var(--line)", text: val })
        ));
      }
      host.append(el("div", { class: "panel", style: "margin-top:12px" },
        el("span", { class: "label", text: GROUP_LABEL[g] || g }), tbl));
    }
    host.append(el("div", { class: "btn-row", style: "margin-top:12px" },
      el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(JSON.stringify(exifObj, (k, v) => Array.isArray(v) ? v : v, 2), `${DP.stripExt(f.name)} — exif.json`) }, "Download as JSON")));
  }

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Read the EXIF");
  runBtn.dataset.busy = "Reading…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a JPEG first.");
    out.textContent = "";
    for (const f of files) {
      const bytes = await DP.bytes(f);
      let exifObj = null;
      try {
        const raw = piexif.load(binString(bytes));
        const hasAny = ["0th", "Exif", "GPS", "Interop"].some(g => raw[g] && Object.keys(raw[g]).length);
        exifObj = hasAny || (raw.thumbnail && raw.thumbnail.length) ? raw : null;
      } catch (e) { exifObj = null; }
      renderOne(out, f, exifObj);
    }
    DP.toast("Done — scroll the report below.");
  }));
})();
