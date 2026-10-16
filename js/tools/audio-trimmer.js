/* Trim Audio — fast copies for MP3/M4A, clean re-encodes for everything else. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The cut" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "from", type: "text", label: "Start", value: "0:00", placeholder: "0:30 or 30.5" },
    { k: "to", type: "text", label: "End (optional)", placeholder: "leave empty for the rest" },
    { k: "fade", type: "check", label: "Add a short fade in/out", value: false,
      hint: "Half a second on each cut — avoids clicks and pops." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "MP3 and M4A cuts copy the stream — instant and lossless. Other formats re-encode in their own codec, so the file type stays the same. The engine (~31 MB) loads once and stays cached." }));
  side.append(note);

  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "The track" }),
    el("p", { class: "mono", style: "font-size:12.5px;color:var(--muted);margin:0", text: "Drop an audio file to see its length." }));
  side.append(info);

  const dz = DP.dropzone(app, {
    accept: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.opus",
    multiple: true, icon: "i-wave",
    title: "Drop audio to trim", hint: "one cut, applied to each file",
    onFiles: async (files) => {
      const p = info.querySelector("p");
      if (!files.length) { p.textContent = "Drop an audio file to see its length."; return; }
      const f = files[0];
      const dur = await probeDuration(f);
      p.textContent = `${f.name} — ${dur ? fmtDur(dur) : "length unknown"}${files.length > 1 ? ` (+${files.length - 1} more)` : ""}`;
    }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Trim");
  runBtn.dataset.busy = "Cutting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function probeDuration(file) {
    return new Promise((res) => {
      const a = document.createElement("audio");
      const url = URL.createObjectURL(file);
      a.preload = "metadata";
      a.onloadedmetadata = () => { res(isFinite(a.duration) ? a.duration : null); URL.revokeObjectURL(url); };
      a.onerror = () => { res(null); URL.revokeObjectURL(url); };
      a.src = url;
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
    if (!files.length) throw new Error("Drop an audio file first.");
    const o = chosen.read();
    if (!timeOk(o.from.trim()) || !timeOk(o.to.trim())) throw new Error("Times look off — use 0:30, 30.5 or 1:02:30.");
    if (!o.from.trim() && !o.to.trim()) throw new Error("Give at least a start or an end.");
    if (!warm) runBtn.innerHTML = '<span class="spinner"></span>Waking the engine…';
    const ff = await DP.ffmpeg();
    warm = true;
    const items = [];
    const prog = DP.progress(out, "Starting…");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = DP.getExt(f.name) || "mp3";
      const IN = "in." + ext;
      const OUT = "out." + ext;
      let stop = null;
      try {
        await ff.writeFile(IN, await DP.bytes(f));
        const cut = [];
        if (o.from.trim()) cut.push("-ss", o.from.trim());
        if (o.to.trim()) cut.push("-to", o.to.trim());
        const losslessCut = o.fade === false && (ext === "mp3" || ext === "m4a" || ext === "aac");
        let ok = false;
        if (losslessCut) {
          runBtn.innerHTML = '<span class="spinner"></span>Copying the stream…';
          try {
            const code = await ff.exec([...cut, "-i", IN, "-c", "copy", "-y", OUT]);
            if (code === 0) {
              const probe = await ff.readFile(OUT).catch(() => null);
              ok = probe && probe.length > 500;
            }
          } catch (e) { ok = false; }
        }
        if (!ok) {
          runBtn.innerHTML = '<span class="spinner"></span>Re-encoding — ' + (i + 1) + " of " + files.length + "…";
          const args = [...cut, "-i", IN, "-vn"];
          if (ext === "mp3") args.push("-c:a", "libmp3lame", "-b:a", "192k");
          else if (ext === "wav") args.push("-c:a", "pcm_s16le");
          else if (ext === "m4a" || ext === "aac" || ext === "wma") args.push("-c:a", "aac", "-b:a", "192k");
          else if (ext === "ogg" || ext === "oga" || ext === "opus") args.push("-c:a", "libvorbis", "-q:a", "5");
          else if (ext === "flac") args.push("-c:a", "flac");
          else args.push("-c:a", "aac", "-b:a", "192k");
          if (o.fade) args.push("-af", "afade=t=in:st=0:d=0.4,areverse,afade=t=in:st=0:d=0.4,areverse");
          args.push("-y", OUT);
          stop = DP.onFFmpeg(e => { if (e.type === "progress") prog.set((i + (e.progress || 0)) / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`); });
          const code2 = await ff.exec(args);
          if (code2 !== 0) throw new Error("the engine exited with " + code2);
        }
        stop && stop();
        const data = await ff.readFile(OUT);
        const mime = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/opus", flac: "audio/flac", wma: "audio/x-ms-wma" }[ext] || "audio/mpeg";
        const blob = new Blob([data], { type: mime });
        const dur = await probeDuration(new File([blob], "x." + ext, { type: mime }));
        items.push({
          name: `${DP.stripExt(f.name)} — trimmed.${ext}`,
          blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}${dur ? " · " + fmtDur(dur) + " long" : ""}${losslessCut ? " · lossless copy" : ""}`
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
    if (!items.length) throw new Error("Nothing could be trimmed.");
    DP.results(out, items, { title: `${DP.plural(items.length, "track")} trimmed`, zipName: "trimmed-audio.zip" });
  }));
})();
