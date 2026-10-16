/* Mute Video — drop the soundtrack without touching a single video pixel. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The silence" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Method", value: "remove", options: [
      { v: "remove", label: "Remove the track" }, { v: "silence", label: "Keep it silent" } ] }
  ]);
  panel.append(el("p", { style: "margin:10px 0 0;font-size:12.5px;color:var(--muted);line-height:1.6",
    text: "Removing is the clean way — the file simply has no audio, and video data is copied byte-for-byte. Keeping a silent track helps some editors and streaming setups that expect an audio channel to exist." }));
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "This is a copy operation, so it's fast even for long videos. The engine (~31 MB) loads on first use and stays cached." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
    multiple: true, icon: "i-media",
    title: "Drop videos to mute", hint: "lossless — batch friendly"
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Mute");
  runBtn.dataset.busy = "Muting…";
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
      const ext = DP.getExt(f.name) || "mp4";
      const IN = "in." + ext;
      const OUT = "out." + ext;
      try {
        prog.set(i / files.length * 100, `${f.name} — ${i + 1} of ${files.length}…`);
        await ff.writeFile(IN, await DP.bytes(f));
        let code;
        if (o.mode === "remove") {
          code = await ff.exec(["-i", IN, "-c", "copy", "-an", "-y", OUT]);
        } else {
          const acodec = ext === "webm" ? "libopus" : "aac";
          code = await ff.exec(["-i", IN, "-c:v", "copy", "-c:a", acodec, "-filter:a", "volume=0", "-y", OUT]);
        }
        if (code !== 0) throw new Error("the engine exited with " + code);
        const data = await ff.readFile(OUT);
        const mime = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo" }[ext] || "video/mp4";
        const blob = new Blob([data], { type: mime });
        items.push({
          name: `${DP.stripExt(f.name)} — muted.${ext}`,
          blob, meta: `${DP.fmtBytes(f.size)} → ${DP.fmtBytes(blob.size)}`
        });
      } catch (e) {
        DP.toast(`Skipped "${f.name}" — ${e.message}`, "err");
      } finally {
        await ff.deleteFile(IN).catch(() => {});
        await ff.deleteFile(OUT).catch(() => {});
      }
    }
    prog.done();
    if (!items.length) throw new Error("Nothing could be muted.");
    DP.results(out, items, { title: `${DP.plural(items.length, "video")} muted`, zipName: "muted-videos.zip" });
  }));
})();
