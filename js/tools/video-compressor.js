/* Compress Video — H.264 with sane settings, honest before/after numbers. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Squeeze settings" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "level", type: "seg", label: "Target", value: "23", options: [
      { v: "23", label: "Balanced" }, { v: "28", label: "Smaller" }, { v: "32", label: "Tiny" } ] },
    { k: "scale", type: "seg", label: "Resolution", value: "0", options: [
      { v: "0", label: "Keep" }, { v: "1080", label: "1080p" }, { v: "720", label: "720p" }, { v: "480", label: "480p" } ] },
    { k: "audio", type: "check", label: "Keep the audio", value: true }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "This transcodes to H.264 — slower than a copy, but that's what actually shrinks video. The engine (~31 MB) loads once and stays cached. If a file somehow comes out bigger, we tell you straight instead of pretending." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
    multiple: true, icon: "i-film",
    title: "Drop videos to compress", hint: "MP4/MOV/MKV/WebM — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Compress");
  runBtn.dataset.busy = "Compressing…";
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
    let before = 0, after = 0;
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const IN = "in." + (DP.getExt(f.name) || "mp4");
      const OUT = "out.mp4";
      let stop = null;
      try {
        await ff.writeFile(IN, await DP.bytes(f));
        const args = ["-i", IN, "-c:v", "libx264", "-crf", o.level, "-preset", "veryfast", "-pix_fmt", "yuv420p"];
        if (o.scale !== "0") args.push("-vf", `scale=-2:min(${o.scale}\\,ih)`);
        if (o.audio) args.push("-c:a", "aac", "-b:a", "128k");
        else args.push("-an");
        args.push("-movflags", "+faststart", "-y", OUT);
        runBtn.innerHTML = '<span class="spinner"></span>Compressing — ' + (i + 1) + " of " + files.length + "…";
        stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((i + (e.progress || 0)) / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`); });
        const code = await ff.exec(args);
        if (code !== 0) throw new Error("the engine exited with " + code);
        const data = await ff.readFile(OUT);
        const blob = new Blob([data], { type: "video/mp4" });
        before += f.size; after += blob.size;
        const pct = Math.round((1 - blob.size / f.size) * 100);
        items.push({
          name: `${DP.stripExt(f.name)} — compressed.mp4`,
          blob, thumb: await DP.thumbFromBlob(await firstFrame(f)),
          meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)} (${pct >= 0 ? pct + "% smaller" : Math.abs(pct) + "% bigger — maybe try \"Smaller\" or 720p"})`
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
    if (!items.length) throw new Error("Nothing could be compressed.");
    const saved = Math.round((1 - after / before) * 100);
    DP.results(out, items, { title: saved > 0 ? `${saved}% smaller overall` : "Done — see the per-file notes", zipName: "compressed-videos.zip" });
  }));

  /* grab the first frame of the ORIGINAL (cheap thumbnail via <video>) */
  function firstFrame(file) {
    return new Promise((res) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(file);
      v.muted = true; v.preload = "metadata";
      let done = false;
      const finish = (blob) => { if (done) return; done = true; URL.revokeObjectURL(url); res(blob || null); };
      v.onloadeddata = () => { try { v.currentTime = 0.1; } catch (e) { /* keep going */ } };
      v.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          c.width = v.videoWidth || 320;
          c.height = v.videoHeight || 180;
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(b => finish(b), "image/jpeg", 0.7);
        } catch (e) { finish(null); }
      };
      v.onerror = () => finish(null);
      setTimeout(() => finish(null), 4000);
      v.src = url;
    });
  }
})();
