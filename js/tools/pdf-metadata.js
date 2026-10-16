/* PDF Metadata Editor — read, fix or wipe the title, author, subject and keywords. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");
  const { PDFDocument } = PDFLib;
  let file = null;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Metadata" }));
  side.append(panel);
  const F = {};
  function field(key, label, placeholder) {
    const input = el("input", { class: "input", type: "text", placeholder: placeholder || "" });
    F[key] = input;
    panel.append(el("div", { class: "field", style: "margin-bottom:14px" },
      el("span", { class: "label", text: label }), input));
    return input;
  }
  field("title", "Title", "e.g. Invoice 2026-014");
  field("author", "Author", "who made this document");
  field("subject", "Subject");
  field("keywords", "Keywords", "comma, separated, words");
  panel.append(el("p", { class: "hint", text: "Clearing a field removes that entry from the file. Nothing else about the pages is touched." }));

  const info = el("div", { class: "panel" }, el("span", { class: "label", text: "Currently in the file" }),
    el("div", { class: "mono", style: "font-size:12px;color:var(--muted);display:grid;gap:6px" },
      el("span", { id: "m-prod", text: "Producer: —" }),
      el("span", { id: "m-creator", text: "Creator: —" }),
      el("span", { id: "m-pages", text: "Pages: —" })));
  side.append(info);

  const out = el("div");
  const dz = DP.dropzone(app, {
    accept: ".pdf,application/pdf", icon: "i-pdf", title: "Drop the PDF",
    onFiles: async (files) => {
      file = files[0] || null;
      const setP = (id, t) => { const n = $(id); if (n) n.textContent = t; };
      if (!file) return;
      try {
        const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
        F.title.value = doc.getTitle() || "";
        F.author.value = doc.getAuthor() || "";
        F.subject.value = doc.getSubject() || "";
        F.keywords.value = doc.getKeywords() || "";
        setP("#m-prod", "Producer: " + (doc.getProducer() || "—"));
        setP("#m-creator", "Creator: " + (doc.getCreator() || "—"));
        setP("#m-pages", `Pages: ${doc.getPageCount()} · ${DP.fmtBytes(file.size)}`);
      } catch (e) {
        setP("#m-prod", "Couldn't read that file — password-protected or damaged?");
      }
    }
  });

  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Save metadata");
  runBtn.dataset.busy = "Saving…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    if (!file) throw new Error("Drop a PDF first.");
    const doc = await PDFDocument.load(await DP.bytes(file), { ignoreEncryption: true });
    const changes = [];
    const apply = (label, value, getter, setter, old) => {
      const v = value.trim();
      if (v !== (old || "")) { setter(v); changes.push(label); }
    };
    apply("title", F.title.value, null, v => doc.setTitle(v), doc.getTitle());
    apply("author", F.author.value, null, v => doc.setAuthor(v), doc.getAuthor());
    apply("subject", F.subject.value, null, v => doc.setSubject(v), doc.getSubject());
    apply("keywords", F.keywords.value, null, v => doc.setKeywords(v ? v.split(",").map(s => s.trim()).filter(Boolean) : []), doc.getKeywords());
    if (!changes.length) { DP.toast("Nothing changed — the fields match the file already."); return; }
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    DP.results(out, [{
      name: `${DP.stripExt(file.name)} — metadata fixed.pdf`, blob,
      meta: `Updated: ${changes.join(", ")}`
    }], { title: "Metadata saved" });
  }));
})();
