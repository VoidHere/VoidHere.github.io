/* Video to GIF — two-pass palette GIFs, the way they're supposed to look. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The GIF" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "fps", type: "range", label: "Frames per second", min: 5, max: 24, value: 12, fmt: v => v + " fps",
      hint: "12–15 is the sweet spot for size and smoothness." },
    { k: "width", type: "number", label: "Width (px)", value: 480, min: 40,
      hint: "Height follows the clip's shape." },
    { k: "from", type: "text", label: "From (optional)", placeholder: "0:05" },
    { k: "to", type: "text", label: "To (optional)", placeholder: "0:12" },
    { k: "loop", type: "check", label: "Loop forever", value: true }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "This runs two passes — it studies the colours of your clip first, then paints each frame with that palette. Slower than a one-shot GIF, and worth every second. Keep clips short; GIFs get heavy fast." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
    icon: "i-film",
    title: "Drop one video to loop", hint: "short clips work best — a few seconds"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Make the GIF");
  runBtn.dataset.busy = "Painting frames…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const timeOk = (s) => !s || /^(\d+(\.\d+)?)(:\d{1,2}(\.\d+)?){0,2}$/.test(s);
  let warm = false;

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a video first.");
    const f = files[0];
    const o = chosen.read();
    if (!timeOk(o.from.trim()) || !timeOk(o.to.trim())) throw new Error("Times look off — use 0:05, 5.5 or 1:02:30.");
    if (!warm) runBtn.innerHTML = '<span class="spinner"></span>Waking the engine…';
    const ff = await DP.ffmpeg();
    warm = true;
    const prog = DP.progress(out, "Reading the clip…");
    const stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((e.progress || 0) * 45, "Studying the colours…"); });
    const IN = "in." + (DP.getExt(f.name) || "mp4");
    const fscale = `fps=${o.fps},scale=${o.width}:-2:flags=lanczos`;
    try {
      runBtn.innerHTML = '<span class="spinner"></span>Studying the colours…';
      await ff.writeFile(IN, await DP.bytes(f));
      const a1 = [];
      if (o.from.trim()) a1.push("-ss", o.from.trim());
      if (o.to.trim()) a1.push("-to", o.to.trim());
      a1.push("-i", IN, "-vf", fscale + ",palettegen", "-y", "pal.png");
      const c1 = await ff.exec(a1);
      if (c1 !== 0) throw new Error("The engine couldn't read that video (exit " + c1 + ").");
      runBtn.innerHTML = '<span class="spinner"></span>Painting the frames…';
      prog.set(50, "Painting the frames…");
      const args2 = [];
      if (o.from.trim()) args2.push("-ss", o.from.trim());
      if (o.to.trim()) args2.push("-to", o.to.trim());
      args2.push("-i", IN, "-i", "pal.png",
        "-lavfi", fscale + "[x];[x][1:v]paletteuse",
        "-loop", o.loop ? "0" : "-1", "-y", "out.gif");
      const rc = await ff.exec(args2);
      stop();
      if (rc !== 0) throw new Error("GIF pass failed (exit " + rc + ").");
      prog.set(95, "Reading the GIF…");
      const data = await ff.readFile("out.gif");
      const blob = new Blob([data], { type: "image/gif" });
      prog.done();
      DP.results(out, [{ name: `${DP.stripExt(f.name)}.gif`, blob, thumb: await DP.thumbFromBlob(blob), meta: DP.fmtBytes(blob.size) }],
        { title: "GIF ready", note: "right-click → Save, or use Download" });
    } finally {
      stop();
      await ff.deleteFile(IN).catch(() => {});
      await ff.deleteFile("pal.png").catch(() => {});
      await ff.deleteFile("out.gif").catch(() => {});
    }
  }));
})();
