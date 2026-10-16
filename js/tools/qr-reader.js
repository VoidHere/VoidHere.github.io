/* QR Reader — decode a QR from an image, a screenshot, or the camera. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Photos, screenshots, scans — the decoder hunts for the code even at an angle or in flat lighting, and tries the inverted colours too. The camera mode uses your webcam directly; frames are scanned in your browser and never stored." }));
  side.append(note);

  const dz = DP.dropzone(app, {
    accept: "image/*",
    multiple: true, icon: "i-qr", thumbs: true,
    title: "Drop screenshots or photos of QR codes", hint: "one code per image works best"
  });

  const camRow = el("div", { class: "btn-row", style: "margin-top:14px" });
  const camBtn = el("button", { class: "btn", type: "button" }, "Or use the camera");
  camRow.append(camBtn);
  app.append(camRow);
  const camBox = el("div", { style: "display:none;margin-top:12px" });
  app.append(camBox);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Read the codes");
  runBtn.dataset.busy = "Scanning…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  function showResult(name, text, meta) {
    out.textContent = "";
    out.append(el("div", { class: "result-head" }, el("h3", { text: name }), meta ? el("span", { class: "label", text: meta }) : null));
    const ta = el("textarea", { class: "input", readonly: "readonly",
      style: "font-family:var(--mono);font-size:13px;line-height:1.6;min-height:90px;margin-top:12px;resize:vertical" });
    ta.value = text;
    out.append(ta);
    out.append(el("div", { class: "btn-row", style: "margin-top:10px" },
      el("button", { class: "btn btn--sm btn--primary", type: "button", onclick: () => DP.copyText(text) }, "Copy"),
      el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.downloadText(text, "qr-content.txt") }, "Download .txt")));
  }

  async function scanBlob(blob) {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    c.width = c.height = 0;
    return res ? { res, w: bmp.width, h: bmp.height } : null;
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const files = dz.files;
    if (!files.length) throw new Error("Drop at least one image with a QR code.");
    out.textContent = "";
    let found = 0;
    for (const f of files) {
      try {
        const hit = await scanBlob(f);
        if (hit) {
          found++;
          showResult(f.name, hit.res.data, `found · ${hit.w}×${hit.h}px`);
          DP.toast(`Read a code in "${f.name}".`);
          if (files.length === 1) return;
        } else {
          DP.toast(`No QR code visible in "${f.name}".`, "err");
        }
      } catch (e) {
        DP.toast(`Couldn't read "${f.name}" — ${e.message}`, "err");
      }
    }
    if (!found) throw new Error("No QR codes found in those images.");
  }));

  /* camera mode */
  let stream = null, scanning = false, rafId = null;
  camBtn.addEventListener("click", async () => {
    if (stream) { stopCam(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (e) {
      DP.toast("No camera access — check the browser's permission prompt.", "err");
      return;
    }
    camBox.style.display = "block";
    camBox.textContent = "";
    const video = el("video", { playsinline: "", muted: "",
      style: "width:100%;max-width:420px;border-radius:10px;border:1.5px solid var(--line);display:block" });
    video.srcObject = stream;
    await video.play().catch(() => {});
    camBox.append(video, el("p", { class: "hint", style: "margin-top:8px", text: "Point the code at the camera — it'll pick it up on its own." }));
    camBtn.textContent = "Stop the camera";
    scanning = true;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (!scanning) return;
      try {
        if (video.videoWidth) {
          c.width = video.videoWidth; c.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
          if (res) {
            stopCam();
            showResult("Camera", res.data, "scanned live");
            DP.toast("Got it — code read from the camera.");
            return;
          }
        }
      } catch (e) { /* frame hiccup — keep scanning */ }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  });
  function stopCam() {
    scanning = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    camBox.style.display = "none";
    camBtn.textContent = "Or use the camera";
  }
})();
