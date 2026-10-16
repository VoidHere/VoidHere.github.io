/* DigitPDF core — shared UI + file plumbing for every tool page.
   No dependencies. Exposes window.DP. */
(() => {
  "use strict";

  /* ---------- tiny DOM helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(node.dataset, v);
      else node.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined) continue;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  const esc = (s) => String(s);
  const fmtBytes = (n) => {
    if (!isFinite(n) || n < 0) return "—";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB";
  };
  const plural = (n, w, p) => n + " " + (n === 1 ? w : (p || w + "s"));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function stripExt(name) { const i = name.lastIndexOf("."); return i > 0 ? name.slice(0, i) : name; }
  function getExt(name) { const i = name.lastIndexOf("."); return i > 0 ? name.slice(i + 1).toLowerCase() : ""; }

  /* ---------- toasts ---------- */
  let toastBox = null;
  function toast(msg, kind = "ok", ms = 3800) {
    if (!document.body) return;
    if (!toastBox) { toastBox = el("div", { class: "toasts" }); document.body.append(toastBox); }
    const t = el("div", { class: "toast" + (kind === "err" ? " toast--err" : "") },
      el("span", { text: msg }),
      el("button", { class: "toast__x", "aria-label": "Dismiss", text: "✕", onclick: () => t.remove() }));
    toastBox.append(t);
    if (ms) setTimeout(() => t.remove(), ms);
    return t;
  }

  /* ---------- downloads ---------- */
  function toBlob(data, type) {
    if (data instanceof Blob) return data;
    return new Blob([data], { type: type || "application/octet-stream" });
  }
  function download(data, name, type) {
    const blob = toBlob(data, type);
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: name || "download" });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }
  function downloadText(text, name, type) { download(new Blob([text], { type: type || "text/plain;charset=utf-8" }), name); }
  function downloadURL(url, name, type) { download(new Blob([urlToBytes(url, type)]), name); }
  function urlToBytes(url, mime) {
    const b64 = url.split(",")[1] || "";
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.");
    } catch (e) {
      const ta = el("textarea", { class: "input" });
      ta.value = text; document.body.append(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      toast("Copied to clipboard.");
    }
  }
  function copyButton(text, label = "Copy") {
    return el("button", { class: "btn btn--sm", type: "button", onclick: () => copyText(typeof text === "function" ? text() : text) }, label);
  }

  /* lazy library loader — same-origin vendor scripts only */
  const libCache = {};
  const globalFor = { "jszip.min.js": "JSZip", "heic2any.min.js": "heic2any", "xlsx.full.min.js": "XLSX", "jsQR.js": "jsQR", "qrcode.js": "qrcode", "JsBarcode.all.min.js": "JsBarcode", "UTIF.js": "UTIF", "pako.min.js": "pako", "piexif.js": "piexif", "marked.min.js": "marked", "turndown.js": "TurndownService", "diff.min.js": "Diff", "tesseract.min.js": "Tesseract", "md5.min.js": "md5", "pdf-lib.min.js": "PDFLib", "pdf.min.js": "pdfjsLib", "fflate.js": "fflate" };
  function lib(file) {
    const g = globalFor[file];
    if (g && window[g]) return Promise.resolve(window[g]);
    if (libCache[file]) return libCache[file];
    libCache[file] = new Promise((res, rej) => {
      const s = el("script", { src: "/vendor/" + file });
      s.onload = () => res(g ? window[g] : true);
      s.onerror = () => rej(new Error("Could not load " + file));
      document.head.append(s);
    });
    return libCache[file];
  }

  /* ---------- dropzone ---------- */
  function matchesAccept(file, accept) {
    if (!accept) return true;
    const rule = String(accept).toLowerCase().trim();
    if (rule === "any" || rule === "*" || rule === "*/*") return true;
    const name = (file.name || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    return rule.split(",").map(s => s.trim().toLowerCase()).filter(Boolean).some(r => {
      if (r === "any" || r === "*" || r === "*/*") return true;
      if (r.startsWith(".")) return name.endsWith(r);
      if (r.endsWith("/*")) return mime.startsWith(r.slice(0, -1));
      return mime === r;
    });
  }
  function dropzone(host, opts = {}) {
    const state = { files: [] };
    const multiple = !!opts.multiple;
    const input = el("input", { type: "file" });
    if (multiple) input.multiple = true;
    if (opts.accept && !/^(any|\*|\*\/\*)$/i.test(String(opts.accept).trim())) input.accept = opts.accept;

    const dz = el("div", { class: "dz" + (opts.compact ? " dz--compact" : ""), tabindex: "0", role: "button",
        "aria-label": opts.title || "Choose a file" },
      el("span", { class: "dz__scissors", html: '<svg class="ic"><use href="#i-scissors"/></svg>' }),
      el("span", { class: "dz__corner dz__corner--tl" }), el("span", { class: "dz__corner dz__corner--tr" }),
      el("span", { class: "dz__corner dz__corner--bl" }), el("span", { class: "dz__corner dz__corner--br" }),
      input,
      el("div", { class: "dz__inner" },
        el("div", { class: "dz__icon", html: `<svg class="ic"><use href="#${opts.icon || "i-upload"}"/></svg>` }),
        el("div", { class: "dz__t", text: opts.title || (multiple ? "Drop your files here" : "Drop your file here") }),
        el("div", { class: "dz__hint", html: `or <span class="dz__browse">browse your device</span> — ${opts.hint || "files stay on your device"}` })));

    const chipRow = el("div", { class: "files" });
    host.append(dz, chipRow);

    function addFiles(list) {
      const incoming = Array.from(list || []);
      const good = incoming.filter(f => matchesAccept(f, opts.accept));
      const bad = incoming.length - good.length;
      if (bad > 0) toast(plural(bad, "file") + " skipped — unsupported type" + (opts.accept ? " (" + opts.accept + ")" : "") + ".", "err");
      if (!good.length) return;
      state.files = multiple ? state.files.concat(good) : [good[0]];
      bumpCount(good.length);
      render();
      opts.onFiles && opts.onFiles(state.files.slice());
    }
    function removeAt(i) {
      state.files.splice(i, 1);
      render();
      opts.onFiles && opts.onFiles(state.files.slice());
    }
    async function render() {
      chipRow.textContent = "";
      for (let i = 0; i < state.files.length; i++) {
        const f = state.files[i];
        const chip = el("span", { class: "filechip" },
          el("span", { text: f.name }),
          el("b", { text: fmtBytes(f.size) }),
          el("button", { type: "button", "aria-label": "Remove " + f.name, html: '<svg class="ic ic--sm"><use href="#i-x"/></svg>', onclick: (e) => { e.stopPropagation(); removeAt(i); } }));
        if (opts.thumbs && /^image\//.test(f.type)) {
          try {
            const img = await makeThumb(f, 26);
            chip.classList.add("filechip--thumb");
            chip.prepend(img);
          } catch (e) { /* not previewable — fine */ }
        }
        chipRow.append(chip);
      }
      if (!state.files.length && opts.onEmpty) opts.onEmpty();
    }

    dz.addEventListener("click", (e) => { if (e.target !== input) input.click(); });
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(t => dz.addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add("dz--over"); }));
    ["dragleave", "drop"].forEach(t => dz.addEventListener(t, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove("dz--over"); }));
    dz.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
    dz.addEventListener("paste", (e) => { if (e.clipboardData && e.clipboardData.files.length) addFiles(e.clipboardData.files); });
    dz.addEventListener("focus", () => {});

    return {
      el: dz,
      get files() { return state.files.slice(); },
      clear() { state.files = []; render(); opts.onFiles && opts.onFiles([]); },
      set(files) { state.files = Array.from(files); render(); opts.onFiles && opts.onFiles(state.files.slice()); }
    };
  }

  /* ---------- options builder ----------
     spec: [{k, label, type, ...}] type: select | range | number | text | check | seg
     returns read() → plain object of values */
  function options(host, spec) {
    const fields = el("div", { class: "fields" });
    const refs = {}, setters = {};
    for (const s of spec) {
      let control;
      if (s.type === "select") {
        control = el("select", { class: "select" }, (s.options || []).map(o => el("option", { value: o.v, text: o.label, selected: String(o.v) === String(s.value) ? "" : null })));
      } else if (s.type === "range") {
        const out = el("b", { class: "mono", style: "font-size:12px;color:var(--accent)", text: String(s.value ?? s.min) });
        const wrap = el("div", {}, el("div", { style: "display:flex;align-items:center;gap:10px" },
          el("span", { class: "mono", style: "font-size:11px;color:var(--muted)", text: s.minUn != null ? String(s.minUn) : "" }),
          control = el("input", { type: "range", min: s.min ?? 0, max: s.max ?? 100, step: s.step ?? 1, value: s.value ?? 0 }),
          el("span", { class: "mono", style: "font-size:11px;color:var(--muted)", text: s.maxUn != null ? String(s.maxUn) : "" })),
          s.show !== false ? el("div", { style: "margin-top:4px" }, out) : null);
        control.addEventListener("input", () => { out.textContent = s.fmt ? s.fmt(Number(control.value)) : control.value; });
        refs[s.k] = () => Number(control.value);
        setters[s.k] = (v) => { control.value = v; control.dispatchEvent(new Event("input", { bubbles: true })); };
        fields.append(el("div", { class: "field" }, el("span", { class: "label", text: s.label || s.k }), wrap, s.hint ? el("span", { class: "hint", text: s.hint }) : null));
        continue;
      } else if (s.type === "number" || s.type === "text") {
        control = el("input", { class: "input", type: s.type, value: s.value ?? "", min: s.min, max: s.max, step: s.step, placeholder: s.placeholder || "" });
      } else if (s.type === "check") {
        control = el("input", { type: "checkbox" });
        control.checked = !!s.value;
        const box = el("label", { class: "check" }, control, el("span", { text: s.label }));
        fields.append(el("div", { class: "field" }, box, s.hint ? el("span", { class: "hint", text: s.hint }) : null));
        refs[s.k] = () => control.checked;
        setters[s.k] = (v) => { control.checked = !!v; };
        continue;
      } else if (s.type === "seg") {
        control = el("div", { class: "seg", role: "group", "aria-label": s.label || s.k });
        let cur = s.value != null ? s.value : (s.options[0] && s.options[0].v);
        for (const o of s.options) {
          const b = el("button", { type: "button", text: o.label, "data-v": o.v, "aria-pressed": String(o.v) === String(cur) ? "true" : "false" });
          b.addEventListener("click", () => {
            cur = o.v;
            $$("button", control).forEach(x => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            s.onChange && s.onChange(cur);
          });
          control.append(b);
        }
        refs[s.k] = () => cur;
        setters[s.k] = (v) => {
          if (String(v) === String(cur)) return;
          cur = v;
          $$("button", control).forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v) === String(v) ? "true" : "false"));
          s.onChange && s.onChange(cur);
        };
        fields.append(el("div", { class: "field" }, el("span", { class: "label", text: s.label || s.k }), control, s.hint ? el("span", { class: "hint", text: s.hint }) : null));
        continue;
      }
      if (control) {
        refs[s.k] = () => (s.type === "number" ? Number(control.value) : control.value);
        setters[s.k] = (v) => { control.value = v; control.dispatchEvent(new Event("input", { bubbles: true })); };
        fields.append(el("div", { class: "field" }, el("span", { class: "label", text: s.label || s.k }), control, s.hint ? el("span", { class: "hint", text: s.hint }) : null));
      }
    }
    host.append(fields);
    return {
      fields,
      read() { const out = {}; for (const k in refs) out[k] = refs[k](); return out; },
      set(k, v) { if (setters[k]) setters[k](v); }
    };
  }

  /* ---------- progress ---------- */
  function progress(host, label = "Working…") {
    const bar = el("div", { class: "prog__bar" });
    const lab = el("div", { class: "prog__label", text: label });
    const wrap = el("div", { class: "prog-wrap" }, el("div", { class: "prog" }, bar), lab);
    host.append(wrap);
    return {
      el: wrap,
      set(pct, text) { bar.style.width = clamp(pct, 0, 100) + "%"; if (text) lab.textContent = text; },
      spin(text) { lab.textContent = text || label; },
      done() { wrap.remove(); },
      fail(text) { lab.textContent = text || "Something went wrong."; }
    };
  }

  /* ---------- results ---------- */
  function results(host, items, opts = {}) {
    host.textContent = "";
    if (opts.title || items.length) {
      host.append(el("div", { class: "result-head" },
        el("h3", { text: opts.title || (items.length === 1 ? "Your file is ready" : plural(items.length, "file") + " ready") }),
        opts.note ? el("span", { class: "label", text: opts.note }) : null));
    }
    if (!items.length && opts.empty) { host.append(el("div", { class: "empty", text: opts.empty })); return; }
    const list = el("div", { class: "results" });
    const asArray = () => items.map(it => ({ name: it.name, blob: it.blob })).filter(it => it.blob);
    for (const it of items) {
      const url = it.url || (it.blob ? URL.createObjectURL(it.blob) : null);
      const card = el("div", { class: "rcard" });
      if (it.thumb) card.append(el("img", { class: "rcard__thumb", src: it.thumb, alt: "" }));
      card.append(
        el("div", { class: "rcard__body" },
          el("div", { class: "rcard__name", text: it.name }),
          el("div", { class: "rcard__meta", text: it.meta || (it.blob ? fmtBytes(it.blob.size) : "") })),
        el("div", { class: "rcard__actions" },
          url ? el("a", { class: "btn btn--sm", href: url, target: "_blank", rel: "noopener", title: "Open in a new tab" }, "Open") : null,
          it.blob ? el("button", { class: "btn btn--sm btn--primary", type: "button", onclick: () => download(it.blob, it.name) }, "Download")
                 : el("a", { class: "btn btn--sm btn--primary", href: url, download: it.name }, "Download")));
      list.append(card);
    }
    host.append(list);
    if (items.length > 1) {
      const zb = el("button", { class: "btn btn--sm", type: "button" }, "Download all as ZIP");
      zb.addEventListener("click", async () => {
        try {
          zb.disabled = true;
          const JSZip = await lib("jszip.min.js");
          const zip = new JSZip();
          const used = {};
          for (const it of asArray()) {
            let n = it.name.replace(/[/\\]/g, "_");
            if (used[n]) { const d = used[n]++; n = n.replace(/(\.[^.]*)?$/, "_" + d + "$1"); } else used[n] = 1;
            zip.file(n, it.blob);
          }
          const out = await zip.generateAsync({ type: "blob" });
          download(out, opts.zipName || "digitpdf-results.zip");
        } catch (e) {
          toast("ZIP failed: " + e.message, "err");
        } finally { zb.disabled = false; }
      });
      host.append(el("div", { style: "margin-top:12px" }, zb));
    }
  }

  /* ---------- busy wrapper ---------- */
  async function busy(btn, fn) {
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>' + (btn.dataset.busy || "Working…");
    try { return await fn(); }
    catch (e) {
      console.error(e);
      toast((e && e.message) ? e.message : "Something went wrong — see console.", "err", 6000);
    }
    finally { btn.disabled = false; btn.innerHTML = old; }
  }

  /* ---------- file helpers ---------- */
  const bytes  = async (file) => new Uint8Array(await file.arrayBuffer());
  const textOf = (file) => file.text();
  const urlOf  = (file) => URL.createObjectURL(file);
  async function makeThumb(file, px = 52) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(px / bmp.width, px / bmp.height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return el("img", { src: c.toDataURL("image/png"), alt: "" });
  }
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("Could not read that image."));
      img.crossOrigin = "anonymous";
      img.src = src;
    });
  }
  async function imageSource(file) {
    /* returns something drawable: ImageBitmap or <img> */
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file); } catch (e) { /* fall through */ }
    }
    return loadImage(URL.createObjectURL(file));
  }
  const dim = (src) => (src.naturalWidth ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height });
  function canvasToBlob(canvas, type = "image/png", quality) {
    return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Canvas export failed.")), type, quality));
  }
  function fitCanvas(w, h, maxW, maxH) {
    const s = Math.min(1, maxW / w, maxH / h);
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), scale: s };
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function thumbFromBlob(blob, px = 84) {
    try {
      const bmp = await createImageBitmap(blob);
      const s = Math.min(px / bmp.width, px / bmp.height);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * s));
      c.height = Math.max(1, Math.round(bmp.height * s));
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL("image/webp", 0.8);
    } catch (e) { return null; }
  }

  /* parse page selections like "1-3, 5, 9-6" into 1-based page numbers */
  function parseRanges(str, max) {
    const out = [];
    const tokens = String(str || "").split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) throw new Error("Type which pages to use — for example: 1-3, 5, 8.");
    for (const tok of tokens) {
      const m = tok.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) throw new Error(`"${tok}" isn't a page or range. Use forms like 4 or 2-7.`);
      const a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
      if (a < 1 || a > max || b < 1 || b > max) {
        throw new Error(`Page ${a > max || b > max ? Math.max(a, b) : Math.min(a, b)} is outside the document (1–${max}).`);
      }
      const step = a <= b ? 1 : -1;
      for (let p = a; p !== b + step; p += step) out.push(p);
    }
    return out;
  }

  /* a ready-made "which pages?" input field */
  function pagesField(label, placeholder) {
    return el("div", { class: "field" },
      el("span", { class: "label", text: label || "Pages" }),
      el("input", { class: "input", type: "text", placeholder: placeholder || "all pages — or type e.g. 1-3, 5" }),
      el("span", { class: "hint", text: "Leave empty to use every page." }));
  }

  /* ---------- text tool helpers ---------- */
  function textArea(placeholder, rows) {
    return el("textarea", { class: "input", spellcheck: "false",
      placeholder: placeholder || "Type or paste here…",
      style: "font-family:var(--mono);font-size:12.5px;line-height:1.6;min-height:" + (rows ? rows * 22 : 170) + "px;margin-top:18px;resize:vertical" });
  }
  function textResult(host, opts = {}) {
    host.textContent = "";
    const text = opts.text == null ? "" : String(opts.text);
    host.append(el("div", { class: "result-head" },
      el("h3", { text: opts.title || "Result" }),
      opts.meta ? el("span", { class: "label", text: opts.meta }) : null));
    const outSnip = text.length > 200000 ? text.slice(0, 200000) : text;
    const ta = el("textarea", { class: "input", readonly: "readonly", spellcheck: "false",
      style: "font-family:var(--mono);font-size:12.5px;line-height:1.6;min-height:" + (opts.rows ? opts.rows * 22 : 180) + "px;white-space:pre;resize:vertical;margin-top:12px" });
    ta.value = outSnip;
    host.append(ta);
    host.append(el("div", { class: "btn-row", style: "margin-top:10px" },
      el("button", { class: "btn btn--sm btn--primary", type: "button", onclick: () => copyText(text) }, "Copy"),
      el("button", { class: "btn btn--sm", type: "button", onclick: () => downloadText(text, opts.filename || "digitpdf-result.txt", opts.mime) }, "Download")));
    if (text.length > 200000) host.append(el("span", { class: "hint", text: "Preview trimmed — Copy and Download use the full text." }));
    return ta;
  }

  /* ---------- ffmpeg engine (shared, lazy) ---------- */
  let ffEngine = null, ffPending = null;
  const ffCbs = new Set();
  /* ffmpeg-core.wasm is ~31 MB, over Cloudflare Pages' 25 MiB per-file cap,
     so on pages.dev it is loaded from the GitHub Pages mirror instead
     (which serves it with Access-Control-Allow-Origin: * — verified).
     Everywhere else the engine is same-origin. Keep the mirror URL in sync
     with SITE_URL if the site ever moves. */
  const WASM_ORIGIN = /(^|\.)pages\.dev$/.test(location.hostname) ? "https://voidhere.github.io" : "";
  function onFFmpeg(cb) { ffCbs.add(cb); return () => ffCbs.delete(cb); }
  function ffEmit(ev) { ffCbs.forEach(cb => { try { cb(ev); } catch (e) { /* listener error — ignore */ } }); }
  function ffmpeg() {
    if (ffEngine) return Promise.resolve(ffEngine);
    if (!window.FFmpegWASM || !FFmpegWASM.FFmpeg) return Promise.reject(new Error("The video engine script didn't load — reload the page and try again."));
    if (!ffPending) {
      ffPending = (async () => {
        const inst = new FFmpegWASM.FFmpeg();
        inst.on("log", ({ message }) => ffEmit({ type: "log", message }));
        inst.on("progress", (d) => ffEmit({ type: "progress", progress: d && d.progress || 0, time: d && d.time }));
        await inst.load({ coreURL: "/vendor/ffmpeg-core.js", wasmURL: WASM_ORIGIN + "/vendor/ffmpeg-core.wasm" });
        /* the wasm side marshals args as C strings, so a JS number arrives as
           an empty string ("-crf 23" → "-crf"). Stringify once, centrally. */
        const rawExec = inst.exec.bind(inst);
        inst.exec = (args, timeout) => rawExec((args || []).map(a => String(a)), timeout);
        ffEngine = inst;
        return inst;
      })().catch(e => { ffPending = null; throw e; });
    }
    return ffPending;
  }

  /* ---------- local file counter (footer) ---------- */
  function bumpCount(n) {
    try {
      const c = (Number(localStorage.getItem("dp-count")) || 0) + n;
      localStorage.setItem("dp-count", String(c));
      $$("[data-count]").forEach(el2 => el2.textContent = c.toLocaleString());
    } catch (e) { /* private mode — fine */ }
  }

  /* ---------- misc page wiring ---------- */
  function initPage() {
    /* theme — light is the house style; dark is opt-in via the toggle */
    const root = document.documentElement;
    const st = localStorage.getItem("dp-theme");
    root.dataset.theme = st === "dark" ? "dark" : "light";
    root.style.colorScheme = root.dataset.theme;
    const tbtn = $(".theme-btn");
    if (tbtn) tbtn.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
      root.style.colorScheme = root.dataset.theme;
      localStorage.setItem("dp-theme", root.dataset.theme);
    });
    /* mobile nav */
    const tog = $(".nav-toggle"), nav = $(".nav");
    if (tog && nav) {
      tog.addEventListener("click", () => {
        const open = nav.classList.toggle("nav--open");
        tog.setAttribute("aria-expanded", open ? "true" : "false");
      });
      $$("a", nav).forEach(a => a.addEventListener("click", () => nav.classList.remove("nav--open")));
    }
    /* current nav item */
    const here = location.pathname.split("/").pop() || "index.html";
    $$(".nav a").forEach(a => {
      const target = (a.getAttribute("href") || "").split("/").pop();
      if (target && target === here) a.setAttribute("aria-current", "page");
    });
    /* footer year */
    $$("[data-year]").forEach(n => n.textContent = new Date().getFullYear());
    /* footer file counter */
    try {
      const c = Number(localStorage.getItem("dp-count")) || 0;
      $$("[data-count]").forEach(n => n.textContent = c.toLocaleString());
    } catch (e) { /* private mode — fine */ }
    /* no accidental file-open when dropping outside a dropzone */
    window.addEventListener("dragover", e => e.preventDefault());
    window.addEventListener("drop", e => e.preventDefault());
  }

  /* icon sprite — injected so every page shares one copy */
  const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<symbol id="i-pdf" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9.5 13.5h5M9.5 16.5h3.5"/></symbol>
<symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15.5 16 11l-7.5 8"/></symbol>
<symbol id="i-media" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 9.2v5.6l4.5-2.8z"/></symbol>
<symbol id="i-text" viewBox="0 0 24 24"><path d="M9 4c-2 0-2 2-2 4s0 4-2.5 4c2.5 0 2.5 2 2.5 4s0 4 2 4"/><path d="M15 4c2 0 2 2 2 4s0 4 2.5 4c-2.5 0-2.5 2-2.5 4s0 4-2 4"/></symbol>
<symbol id="i-util" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></symbol>
<symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 13 4.5 4.5L19 7"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/><path d="m9 12 2 2 4-4"/></symbol>
<symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
<symbol id="i-hash" viewBox="0 0 24 24"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></symbol>
<symbol id="i-qr" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM19.5 14H21M14 19.5V21M18 18h3v3h-3z"/></symbol>
<symbol id="i-film" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></symbol>
<symbol id="i-wave" viewBox="0 0 24 24"><path d="M5 10v4M8.5 7v10M12 4v16M15.5 8v8M19 11v2"/></symbol>
<symbol id="i-archive" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></symbol>
<symbol id="i-palette" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 .4 18c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.3a4.9 4.9 0 0 0 5-5C21 6.8 17 3 12 3z"/><circle cx="8.5" cy="10.5" r=".9"/><circle cx="7.8" cy="14.5" r=".9"/><circle cx="12" cy="7.8" r=".9"/></symbol>
<symbol id="i-type" viewBox="0 0 24 24"><path d="M5 7V4h14v3"/><path d="M12 4v16"/><path d="M9 20h6"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
<symbol id="i-key" viewBox="0 0 24 24"><path d="m20.5 3.5-2 2m-4.1 4.1a5.6 5.6 0 1 1-7.9 7.9 5.6 5.6 0 0 1 7.9-7.9zm0 0 4.4-4.4"/><path d="m18 6 2.5 2.5L23 6l-2.5-2.5"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-ruler" viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v3M14 8v3M18 8v3"/></symbol>
</svg>`;

  /* boot */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { document.body.insertAdjacentHTML("afterbegin", SPRITE); initPage(); });
  } else { document.body.insertAdjacentHTML("afterbegin", SPRITE); initPage(); }

  window.DP = {
    $, $$, el, esc, fmtBytes, plural, clamp, uid, stripExt, getExt,
    toast, download, downloadText, downloadURL, copyText, copyButton, lib,
    dropzone, options, progress, results, busy, bumpCount,
    bytes, textOf, urlOf, makeThumb, loadImage, imageSource, dim, canvasToBlob, fitCanvas, sleep,
    parseRanges, pagesField, thumbFromBlob, ffmpeg, onFFmpeg, textArea, textResult
  };
})();
