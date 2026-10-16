/* Crop Images — drag a box, fine-tune numerically, apply to one or a batch. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  let sel = null;        // {x, y, w, h} in *image* pixels of the first loaded image
  let base = null;       // {img, w, h, disp}  disp = display scale (<1 fits width)
  const nums = {};

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Crop box (pixels)" }));
  side.append(panel);
  for (const [k, label] of [["x", "Left"], ["y", "Top"], ["w", "Width"], ["h", "Height"]]) {
    const inp = el("input", { class: "input", type: "number", min: 0, step: 1 });
    nums[k] = inp;
    inp.addEventListener("input", () => {
      if (!base || !sel) return;
      const v = Math.max(0, Math.round(Number(inp.value) || 0));
      const s = { ...sel };
      if (k === "x") s.x = Math.min(v, base.w - 8);
      if (k === "y") s.y = Math.min(v, base.h - 8);
      if (k === "w") s.w = Math.max(8, Math.min(v, base.w - s.x));
      if (k === "h") s.h = Math.max(8, Math.min(v, base.h - s.y));
      sel = s;
      syncOverlay();
    });
    panel.append(el("div", { class: "field", style: "margin-bottom:10px" },
      el("span", { class: "label", text: label }), inp));
  }
  panel.append(el("p", { class: "hint", text: "In a batch, this box is applied proportionally to every image — so the same region gets cropped from each." }));

  const out = el("div", { style: "margin-top:18px" });
  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true, icon: "i-image", thumbs: true, compact: true,
    title: "Drop the image (or a batch)",
    onFiles: loadFirst
  });

  const stage = el("div", { class: "crop-stage" });
  const imgEl = new Image();
  imgEl.className = "crop-img";
  imgEl.alt = "";
  const overlay = el("div", { class: "crop-box" });
  for (const h of ["nw", "ne", "sw", "se"]) overlay.append(el("span", { class: "crop-handle", dataset: { handle: h } }));
  stage.append(imgEl, overlay);
  stage.style.display = "none";
  app.append(el("div", { style: "margin-top:18px" }, stage), out);

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Crop");
  runBtn.dataset.busy = "Cropping…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  stage.classList.add("crop-stage");

  panel.append(el("style", { text: `
    .crop-stage { position: relative; user-select: none; touch-action: none; border: 1.5px solid var(--ink); background: #222; max-width: 100%; overflow: hidden; }
    .crop-img { display: block; width: 100%; height: auto; }
    .crop-box { position: absolute; border: 2px dashed #fff; box-shadow: 0 0 0 9999px rgba(0,0,0,.45); cursor: move; }
    .crop-handle { position: absolute; width: 14px; height: 14px; background: var(--accent); border: 2px solid #fff; }
    .crop-handle[data-handle="nw"] { left: -8px; top: -8px; cursor: nwse-resize; }
    .crop-handle[data-handle="ne"] { right: -8px; top: -8px; cursor: nesw-resize; }
    .crop-handle[data-handle="sw"] { left: -8px; bottom: -8px; cursor: nesw-resize; }
    .crop-handle[data-handle="se"] { right: -8px; bottom: -8px; cursor: nwse-resize; }
  ` }));

  async function loadFirst(files) {
    if (!files.length) { stage.style.display = "none"; base = null; return; }
    try {
      const src = await DP.imageSource(files[0]);
      const { w, h } = DP.dim(src);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(src, 0, 0);
      imgEl.src = c.toDataURL("image/png");
      await new Promise(r => imgEl.complete ? r() : imgEl.onload = r);
      base = { w, h };
      sel = { x: 0, y: 0, w: w, h: h };
      stage.style.display = "";
      syncOverlay();
    } catch (e) {
      DP.toast("That file isn't readable as an image.", "err");
    }
  }

  function syncOverlay() {
    if (!base || !sel || !imgEl.clientWidth) return;
    const k = imgEl.clientWidth / base.w;
    overlay.style.left = sel.x * k + "px";
    overlay.style.top = sel.y * k + "px";
    overlay.style.width = sel.w * k + "px";
    overlay.style.height = sel.h * k + "px";
    nums.x.value = Math.round(sel.x); nums.y.value = Math.round(sel.y);
    nums.w.value = Math.round(sel.w); nums.h.value = Math.round(sel.h);
  }
  addEventListener("resize", syncOverlay);

  let drag = null;
  function pt(e) {
    const r = imgEl.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * base.w, y: (e.clientY - r.top) / r.height * base.h };
  }
  stage.addEventListener("pointerdown", (e) => {
    if (!base) return;
    const handle = e.target.dataset && e.target.dataset.handle;
    drag = { mode: handle || "move", start: pt(e), orig: { ...sel } };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || !base) return;
    const p = pt(e);
    const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    const o = drag.orig, min = 16;
    let s = { ...o };
    if (drag.mode === "move") {
      s.x = Math.min(Math.max(0, o.x + dx), base.w - o.w);
      s.y = Math.min(Math.max(0, o.y + dy), base.h - o.h);
    } else if (drag.mode === "nw") {
      s.w = Math.max(min, o.w - dx); s.h = Math.max(min, o.h - dy);
      s.x = Math.min(Math.max(0, o.x + dx), o.x + o.w - min);
      s.y = Math.min(Math.max(0, o.y + dy), o.y + o.h - min);
      s.w = o.x + o.w - s.x; s.h = o.y + o.h - s.y;
    } else if (drag.mode === "ne") {
      s.y = Math.min(Math.max(0, o.y + dy), o.y + o.h - min);
      s.w = Math.min(Math.max(min, o.w + dx), base.w - o.x);
      s.h = o.y + o.h - s.y;
    } else if (drag.mode === "sw") {
      s.x = Math.min(Math.max(0, o.x + dx), o.x + o.w - min);
      s.h = Math.min(Math.max(min, o.h + dy), base.h - o.y);
      s.w = o.x + o.w - s.x;
    } else if (drag.mode === "se") {
      s.w = Math.min(Math.max(min, o.w + dx), base.w - o.x);
      s.h = Math.min(Math.max(min, o.h + dy), base.h - o.y);
    }
    sel = s;
    syncOverlay();
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length || !base || !sel) throw new Error("Drop an image and set the crop box first.");
    const pct = { x: sel.x / base.w, y: sel.y / base.h, w: sel.w / base.w, h: sel.h / base.h };
    const items = [];
    for (const f of files) {
      try {
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        const sx = Math.round(pct.x * w), sy = Math.round(pct.y * h);
        const sw = Math.min(Math.round(pct.w * w), w - sx), sh = Math.min(Math.round(pct.h * h), h - sy);
        if (sw < 4 || sh < 4) { DP.toast(`"${f.name}" is too small for this crop box.`, "err"); continue; }
        const c = document.createElement("canvas");
        c.width = sw; c.height = sh;
        const ctx = c.getContext("2d");
        const type = f.type === "image/png" ? "image/png" : (f.type === "image/webp" ? "image/webp" : "image/jpeg");
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, sw, sh); }
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
        const blob = await DP.canvasToBlob(c, type, type === "image/png" ? undefined : 0.92);
        items.push({
          name: `${DP.stripExt(f.name)} — cropped.${DP.getExt(f.name) || "png"}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: `${sw}×${sh}px · ${DP.fmtBytes(blob.size)}`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be cropped.");
    DP.results(out, items, { title: `${DP.plural(items.length, "image")} cropped`, zipName: "cropped-images.zip" });
  }));
})();
