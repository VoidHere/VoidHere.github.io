/* Trim Video — fast keyframe cuts, or frame-precise re-encodes. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The cut" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "from", type: "text", label: "Start", value: "0:00", placeholder: "0:12 or 12.5" },
    { k: "to", type: "text", label: "End (optional)", placeholder: "leave empty for the rest" },
    { k: "mode", type: "seg", label: "Cut style", value: "fast", options: [
      { v: "fast", label: "Fast" }, { v: "precise", label: "Frame-precise" } ] },
    { k: "audio", type: "check", label: "Keep the audio", value: true }
  ]);
  panel.append(el("p", { style: "margin:10px 0 0;font-size:12.5px;color:var(--muted);line-height:1.6",
    text: "Fast copies the compressed data as-is — near instant, but the cut lands on the nearest keyframe. Frame-precise re-encodes around the cut so it lands exactly where you asked." }));
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "The engine (~31 MB) loads on first use and stays cached. The clip never leaves your machine — not even the trimmed parts." }));
  side.append(note);

  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "The clip" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Drop a video to see its length." }));
  side.append(info);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
    icon: "i-film",
    title: "Drop one video to trim", hint: "MP4, MOV, MKV, WebM, AVI…",
    onFiles: async (files) => {
      const p = info.querySelector("p");
      if (!files.length) { p.textContent = "Drop a video to see its length."; return; }
      const f = files[0];
      const dur = await probeDuration(f);
      p.textContent = `${f.name} — ${dur ? fmtDur(dur) : "length unknown"}, ${DP.fmtBytes(f.size)}`;
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Cut it");
  runBtn.dataset.busy = "Cutting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function probeDuration(file) {
    return new Promise((res) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(file);
      v.preload = "metadata";
      v.onloadedmetadata = () => { res(isFinite(v.duration) ? v.duration : null); URL.revokeObjectURL(url); };
      v.onerror = () => { res(null); URL.revokeObjectURL(url); };
      v.src = url;
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
    if (!o.from.trim() && !o.to.trim()) throw new Error("Give at least a start or an end.");
    const ext = DP.getExt(f.name) || "mp4";
    if (!warm) runBtn.innerHTML = '<span class="spinner"></span>Waking the engine…';
    const ff = await DP.ffmpeg();
    warm = true;
    const IN = "in." + ext;
    const OUT = "out." + ext;
    const prog = DP.progress(out, "Reading the clip…");
    const stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((e.progress || 0) * 100, "Cutting…"); });
    try {
      await ff.writeFile(IN, await DP.bytes(f));
      const cut = [];
      if (o.from.trim()) cut.push("-ss", o.from.trim());
      if (o.to.trim()) cut.push("-to", o.to.trim());
      let ok = false;
      if (o.mode === "fast") {
        runBtn.innerHTML = '<span class="spinner"></span>Copying the stream…';
        try {
          const code = await ff.exec([...cut, "-i", IN, "-c", "copy", "-avoid_negative_ts", "make_zero", "-y", OUT]);
          if (code === 0) {
            const probe = await ff.readFile(OUT).catch(() => null);
            ok = probe && probe.length > 1000;
          }
        } catch (e) { ok = false; }
      }
      if (!ok) {
        if (o.mode === "fast") DP.toast("Fast copy didn't fit this file — re-encoding around the cut instead.", "ok", 5000);
        runBtn.innerHTML = '<span class="spinner"></span>Re-encoding around the cut…';
        const args = [...cut, "-i", IN, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"];
        if (o.audio) args.push("-c:a", "aac", "-b:a", "160k"); else args.push("-an");
        args.push("-y", OUT);
        const code2 = await ff.exec(args);
        if (code2 !== 0) throw new Error("the engine exited with " + code2);
      }
      stop();
      const data = await ff.readFile(OUT);
      const mime = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo" }[ext] || "video/mp4";
      const blob = new Blob([data], { type: mime });
      const dur = await probeDuration(new File([blob], "x." + ext, { type: mime }));
      prog.done();
      DP.results(out, [{
        name: `${DP.stripExt(f.name)} — ${o.from.trim() || "0:00"} to ${o.to.trim() || "end"}.${ext}`,
        blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}${dur ? " · " + fmtDur(dur) + " long" : ""}`
      }], { title: "Cut ready" });
    } finally {
      stop();
      await ff.deleteFile(IN).catch(() => {});
      await ff.deleteFile(OUT).catch(() => {});
    }
  }));
})();
