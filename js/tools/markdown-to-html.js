/* Markdown to HTML — GitHub-flavoured, with a live sandboxed preview. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Output" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Wrap as", value: "full", options: [
      { v: "frag", label: "Fragment" }, { v: "full", label: "Standalone page" } ] },
    { k: "breaks", type: "check", label: "Single newline = line break", value: false,
      hint: "Chat-style writing instead of book-style paragraphs." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Tables, task lists, footnotes, fenced code — the GitHub flavour, all on. The preview below runs inside a sandbox, so no scripts in pasted markdown can do anything." }));
  side.append(note);

  const ta = DP.textArea("Paste Markdown here…", 10);
  app.append(ta);
  const dz = DP.dropzone(app, {
    accept: ".md,.markdown,.txt,text/markdown,text/plain", compact: true, icon: "i-text",
    title: "…or drop a .md file", hint: "it lands in the box above",
    onFiles: async (files) => { if (files.length) ta.value = await files[0].text(); }
  });

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert to HTML");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const PAGE = (body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Document</title>
<style>
  body { max-width: 46rem; margin: 3rem auto; padding: 0 1.2rem; font: 16px/1.7 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1c1a17; }
  h1, h2, h3 { line-height: 1.25; margin-top: 2em; }
  code, pre { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: .92em; background: #f4f2ee; border-radius: 4px; }
  code { padding: .12em .35em; }
  pre { padding: .9em 1.1em; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 1.2em 0; padding: .2em 1.1em; border-left: 3px solid #c9c4ba; color: #55524c; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #d8d4cc; padding: .4em .7em; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #d8d4cc; margin: 2.5em 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste some Markdown first.");
    const o = chosen.read();
    marked.setOptions({ gfm: true, breaks: !!o.breaks });
    let html = marked.parse(src);
    if (o.mode === "full") html = PAGE(html);
    DP.textResult(out, {
      title: "HTML ready",
      text: html,
      mime: "text/html",
      filename: "document.html",
      meta: `${DP.fmtBytes(src.length)} markdown → ${DP.fmtBytes(html.length)} HTML`
    });
    out.append(el("div", { class: "panel", style: "margin-top:16px" },
      el("span", { class: "label", text: "Preview (sandboxed)" }),
      el("iframe", { sandbox: "", srcdoc: html, style: "width:100%;height:340px;border:1.5px solid var(--line);border-radius:8px;background:#fff;margin-top:8px" })));
  }));
})();
