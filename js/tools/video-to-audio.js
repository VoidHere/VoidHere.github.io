/* Video to Audio — pull the soundtrack out as MP3, WAV or M4A. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The audio" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "format", type: "seg", label: "Format", value: "mp3", options: [
      { v: "mp3", label: "MP3" }, { v: "wav", label: "WAV" }, { v: "m4a", label: "M4A" } ] },
    { k: "bitrate", type: "select", label: "Bitrate", value: "192", options: [
      { v: "128", label: "128 kbps — small" },
      { v: "192", label: "192 kbps — recommended" },
      { v: "320", label: "320 kbps — generous" } ],
      hint: "Ignored by WAV, which is always lossless and huge." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "The video engine (~31 MB) loads on first use, then lives in your browser cache. Extraction keeps the original sample rate — we only re-encode the format you pick." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
    multiple: true, icon: "i-media",
    title: "Drop videos to un-mute", hint: "batch friendly — a file per video"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Extract audio");
  runBtn.dataset.busy = "Extracting…";
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
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const IN = "in." + (DP.getExt(f.name) || "mp4");
      const OUT = "out." + o.format;
      let stop = null;
      try {
        await ff.writeFile(IN, await DP.bytes(f));
        const args = ["-i", IN, "-vn"];
        if (o.format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", o.bitrate + "k");
        else if (o.format === "wav") args.push("-c:a", "pcm_s16le");
        else args.push("-c:a", "aac", "-b:a", o.bitrate + "k");
        args.push("-y", OUT);
        runBtn.innerHTML = '<span class="spinner"></span>Extracting — ' + (i + 1) + " of " + files.length + "…";
        stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((i + (e.progress || 0)) / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`); });
        const code = await ff.exec(args);
        if (code !== 0) throw new Error("the engine exited with " + code);
        const data = await ff.readFile(OUT);
        const mime = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" }[o.format];
        const blob = new Blob([data], { type: mime });
        items.push({
          name: `${DP.stripExt(f.name)}.${o.format}`,
          blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}`
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
    if (!items.length) throw new Error("Nothing could be extracted — do those videos have sound?");
    DP.results(out, items, { title: `${DP.plural(items.length, "track")} extracted`, zipName: "video-audio.zip" });
  }));
})();
