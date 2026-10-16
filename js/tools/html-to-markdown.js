/* HTML to Markdown — turn any page's markup into tidy, editable .md. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Style" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "heading", type: "seg", label: "Headings", value: "atx", options: [
      { v: "atx", label: "# style" }, { v: "setext", label: "Underlined" } ] },
    { k: "bullet", type: "seg", label: "Bullets", value: "-", options: [
      { v: "-", label: "-" }, { v: "*", label: "*" }, { v: "+", label: "+" } ] },
    { k: "code", type: "seg", label: "Code blocks", value: "fenced", options: [
      { v: "fenced", label: "``` fenced" }, { v: "indented", label: "Indented" } ] }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Scripts and styles are dropped on the way through; links, images, tables, bold and code all keep their meaning. Perfect for rescuing notes from a dead CMS." }));
  side.append(note);

  const ta = DP.textArea("Paste HTML here…", 10);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: ".html,.htm,.txt,text/html,text/plain", compact: true, icon: "i-text",
    title: "…or drop an .html file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) ta.value = await files[0].text(); }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to Markdown");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste some HTML first.");
    const o = chosen.read();
    const svc = new TurndownService({
      headingStyle: o.heading === "setext" ? "setext" : "atx",
      bulletListMarker: o.bullet,
      codeBlockStyle: o.code,
      emDelimiter: "*"
    });
    svc.remove(["script", "style", "noscript"]);
    let md;
    try { md = svc.turndown(src); }
    catch (e) { throw new Error("Couldn't parse that HTML — " + e.message); }
    DP.textResult(out, {
      title: "Markdown ready",
      text: md,
      mime: "text/markdown",
      filename: "document.md",
      meta: `${DP.fmtBytes(src.length)} HTML → ${DP.fmtBytes(md.length)} markdown · ${md.split("\n").length} lines`
    });
  }));
})();
