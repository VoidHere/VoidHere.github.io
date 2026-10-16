/* Video to Frames — pull stills out of a clip as numbered JPG/PNG files. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Frames" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "every", type: "seg", label: "How often", value: "1", options: [
      { v: "1", label: "1 / second" }, { v: "N", label: "Every N sec" }, { v: "fps", label: "Fixed FPS" } ] },
    { k: "n", type: "number", label: "N (seconds)", value: 5, min: 1, hint: "Used by \"every N seconds\"." },
    { k: "fps", type: "number", label: "Frames per second", value: 2, min: 1, max: 60, hint: "Used by \"fixed FPS\"." },
    { k: "from", type: "text", label: "From (optional)", placeholder: "0:12 or 12.5" },
    { k: "to", type: "text", label: "To (optional)", placeholder: "0:45" },
    { k: "format", type: "seg", label: "Format", value: "jpg", options: [
      { v: "jpg", label: "JPG" }, { v: "png", label: "PNG" } ] },
    { k: "width", type: "number", label: "Max width (px)", value: 0, min: 0, hint: "0 = original size." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "The video engine (~31 MB) loads the first time — after that the browser has it cached. A long clip at 1 frame/second makes a lot of files; use the From/To boxes to keep it tidy." }));
  side.append(note);

  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "The clip" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Drop a video to see its length." }));
  side.append(info);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
    icon: "i-film",
    title: "Drop one video", hint: "MP4, MOV, MKV, WebM, AVI…",
    onFiles: async (files) => {
      const p = info.querySelector("p");
      if (!files.length) { p.textContent = "Drop a video to see its length."; return; }
      const f = files[0];
      const dur = await probeDuration(f, "video");
      p.textContent = `${f.name} — ${dur ? fmtDur(dur) : "length unknown"}, ${DP.fmtBytes(f.size)}`;
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Extract frames");
  runBtn.dataset.busy = "Extracting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function probeDuration(file, kind) {
    return new Promise((res) => {
      const media = document.createElement(kind);
      const url = URL.createObjectURL(file);
      media.preload = "metadata";
      media.onloadedmetadata = () => { res(isFinite(media.duration) ? media.duration : null); URL.revokeObjectURL(url); };
      media.onerror = () => { res(null); URL.revokeObjectURL(url); };
      media.src = url;
    });
  }
  function fmtDur(s) {
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (h ? h + "h " : "") + (h || m ? m + "m " : "") + sec + "s";
  }
  const timeOk = (s) => !s || /^(\d+(\.\d+)?)(:\d{1,2}(\.\d+)?){0,2}$/.test(s);
  let warm = false;

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop a video first.");
    const f = files[0];
    const o = chosen.read();
    if (!timeOk(o.from.trim()) || !timeOk(o.to.trim())) throw new Error("Times look off — use 0:12, 12.5 or 1:02:30.");
    const ext = o.format === "png" ? "png" : "jpg";
    if (!warm) runBtn.innerHTML = '<span class="spinner"></span>Waking the engine…';
    const ff = await DP.ffmpeg();
    warm = true;
    const prog = DP.progress(out, "Reading the clip…");
    const stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((e.progress || 0) * 45, "Choosing the frames…"); });
    const inName = "in." + (DP.getExt(f.name) || "mp4");
    const IN = inName;
    try {
      await ff.writeFile(IN, await DP.bytes(f));
      const rate = o.every === "fps" ? Math.max(1, o.fps) : o.every === "N" ? 1 / Math.max(1, o.n) : 1;
      const vf = [`fps=${rate}`];
      if (o.width > 0) vf.push(`scale=${o.width}:-2`);
      const args = [];
      if (o.from.trim()) args.push("-ss", o.from.trim());
      if (o.to.trim()) args.push("-to", o.to.trim());
      args.push("-i", IN, "-vf", vf.join(","));
      /* Always pull PNG frames — the engine build's MJPEG encoder is broken
         ("Error submitting video frame to the encoder"), so a JPG is made
         from each PNG in the browser instead of by ffmpeg. */
      args.push("frame_%04d.png");
      const code = await ff.exec(args);
      if (code !== 0) throw new Error("The engine couldn't read that video (exit " + code + "). Is it really a video file?");
      stop();
      const all = await ff.listDir("/");
      const frames = all.filter(e => !e.isDir && /^frame_\d+\.png$/.test(e.name)).map(e => e.name).sort();
      if (!frames.length) throw new Error("No frames came out — check the From/To times.");
      const items = [];
      for (let i = 0; i < frames.length; i++) {
        prog.set(45 + i / frames.length * 55, `Collecting frame ${i + 1} of ${frames.length}…`);
        const data = await ff.readFile(frames[i]);
        const pngBlob = new Blob([data.buffer ? data : new Uint8Array(data)], { type: "image/png" });
        let blob = pngBlob;
        if (ext === "jpg") {
          const bmp = await createImageBitmap(pngBlob);
          const c = document.createElement("canvas");
          c.width = bmp.width; c.height = bmp.height;
          c.getContext("2d").drawImage(bmp, 0, 0);
          bmp.close && bmp.close();
          blob = await DP.canvasToBlob(c, "image/jpeg", 0.92);
        }
        items.push({
          name: `${DP.stripExt(f.name)} — ${frames[i].replace(/^frame_/, "").replace(/\.[a-z]+$/, "")}.${ext}`,
          blob, thumb: await DP.thumbFromBlob(blob),
          meta: DP.fmtBytes(blob.size)
        });
        await ff.deleteFile(frames[i]).catch(() => {});
      }
      prog.done();
      DP.results(out, items, { title: `${DP.plural(items.length, "frame")} extracted`, zipName: `${DP.stripExt(f.name)}-frames.zip` });
    } finally {
      stop();
      await ff.deleteFile(IN).catch(() => {});
    }
  }));
})();
