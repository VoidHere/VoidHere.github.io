/* Convert Video — MP4 / WebM / MKV with codecs that play everywhere. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Convert to" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "target", type: "seg", label: "Target", value: "mp4", options: [
      { v: "mp4", label: "MP4" }, { v: "webm", label: "WebM" }, { v: "mkv", label: "MKV" } ] },
    { k: "quality", type: "range", label: "Quality", min: 18, max: 32, value: 23, fmt: v => "CRF " + v,
      hint: "Lower is better looking and bigger. 23 is the usual sweet spot." },
    { k: "audio", type: "check", label: "Keep the audio", value: true },
    { k: "size", type: "check", label: "Shrink to 1080p if larger", value: false }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Which one?" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "MP4 (H.264) plays absolutely everywhere — phones, TVs, editors, group chats. WebM (VP8) is smaller for the web but fussier elsewhere. MKV is a friendly container for archiving. The engine (~31 MB) loads once." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.wmv,.flv",
    multiple: true, icon: "i-film",
    title: "Drop videos to convert", hint: "almost any format goes in — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  let warm = false;

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a video first.");
    const o = chosen.read();
    if (!warm) runBtn.innerHTML = '<span class="spinner"></span>Waking the engine…';
    const ff = await DP.ffmpeg();
    warm = true;
    const ext = o.target;
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const IN = "in." + (DP.getExt(f.name) || "mp4");
      const OUT = "out." + ext;
      let stop = null;
      try {
        await ff.writeFile(IN, await DP.bytes(f));
        const args = ["-i", IN];
        /* VP9 + MJPEG crash this engine build, VP8 is solid — use libvpx. */
        if (ext === "webm") args.push("-c:v", "libvpx", "-crf", o.quality, "-b:v", "0");
        else args.push("-c:v", "libx264", "-crf", o.quality, "-preset", "veryfast", "-pix_fmt", "yuv420p");
        if (o.size) args.push("-vf", "scale=-2:min(1080\\,ih)");
        if (o.audio) args.push("-c:a", ext === "webm" ? "libopus" : "aac", "-b:a", "160k");
        else args.push("-an");
        if (ext === "mp4") args.push("-movflags", "+faststart");
        args.push("-y", OUT);
        runBtn.innerHTML = '<span class="spinner"></span>Converting — ' + (i + 1) + " of " + files.length + "…";
        stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((i + (e.progress || 0)) / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`); });
        const code = await ff.exec(args);
        if (code !== 0) throw new Error("the engine exited with " + code);
        const data = await ff.readFile(OUT);
        const mime = { mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska" }[ext];
        const blob = new Blob([data], { type: mime });
        const pct = Math.round((1 - blob.size / f.size) * 100);
        items.push({
          name: `${DP.stripExt(f.name)}.${ext}`,
          blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)} (${pct >= 0 ? pct + "% smaller" : Math.abs(pct) + "% bigger"})`
        });
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      } finally {
        stop && stop();
        await ff.deleteFile(IN).catch(() => {});
        await ff.deleteFile(OUT).catch(() => {});
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing could be converted.");
    DP.results(out, items, { title: `${DP.plural(items.length, "video")} converted`, zipName: "converted-videos.zip" });
  }));
})();
