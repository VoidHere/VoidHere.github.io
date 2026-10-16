/* Flip Images — mirror horizontally, vertically, or both. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Mirror" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "dir", type: "seg", label: "Direction", value: "h", options: [
      { v: "h", label: "Horizontal" }, { v: "v", label: "Vertical" }, { v: "both", label: "Both" } ] }
  ]);
  panel.append(el("p", { class: "hint", style: "margin-top:12px", text: "Horizontal swaps left and right — the mirror look. Both at once equals a 180° turn, if you're keeping score." }));

  const dz = DP.dropzone(app, {
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true, icon: "i-image", thumbs: true,
    title: "Drop images to flip"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Flip");
  runBtn.dataset.busy = "Flipping…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image.");
    const { dir } = chosen.read();
    const items = [];
    for (const f of files) {
      try {
        const src = await DP.imageSource(f);
        const { w, h } = DP.dim(src);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        const type = f.type === "image/png" ? "image/png" : (f.type === "image/webp" ? "image/webp" : "image/jpeg");
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
        ctx.translate(dir === "h" || dir === "both" ? w : 0, dir === "v" || dir === "both" ? h : 0);
        ctx.scale(dir === "h" || dir === "both" ? -1 : 1, dir === "v" || dir === "both" ? -1 : 1);
        ctx.drawImage(src, 0, 0, w, h);
        const blob = await DP.canvasToBlob(c, type, type === "image/png" ? undefined : 0.92);
        items.push({
          name: `${DP.stripExt(f.name)} — flipped.${DP.getExt(f.name) || "png"}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: dir === "both" ? "flipped both ways" : `flipped ${dir === "h" ? "horizontally" : "vertically"}`
        });
        c.width = c.height = 0;
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!items.length) throw new Error("Nothing could be flipped.");
    DP.results(out, items, { title: `${DP.plural(items.length, "image")} flipped`, zipName: "flipped-images.zip" });
  }));
})();
