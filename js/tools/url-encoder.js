/* URL Encoder — percent-encoding done right, component or whole link. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "Mode" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "mode", type: "seg", label: "Convert", value: "comp", options: [
      { v: "comp", label: "Encode a value" }, { v: "full", label: "Encode a URL" }, { v: "dec", label: "Decode" } ] },
    { k: "plus", type: "check", label: "Spaces as + (form style)", value: false,
      hint: "For query strings only — normal links want %20." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Which one?" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "\"Encode a value\" is for one piece of data — a search term, a filename, an email. \"Encode a URL\" keeps the :/?#&= structure intact and only fixes what's actually broken." }));
  side.append(note);

  const ta = DP.textArea("Paste a link, a query value, or an encoded string…", 7);
  app.append(ta);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Convert");
  runBtn.dataset.busy = "Converting…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const src = ta.value;
    if (!src.trim()) throw new Error("Paste something first.");
    const o = chosen.read();
    let res, title;
    if (o.mode === "dec") {
      try { res = decodeURIComponent(src.replace(/\+/g, " ")); }
      catch (e) {
        try { res = decodeURI(src); }
        catch (e2) { throw new Error("That string has a stray % or malformed escape — nothing sensible to decode."); }
      }
      title = "Decoded";
    } else if (o.mode === "full") {
      res = o.plus ? encodeURI(src).replace(/%20/g, "+") : encodeURI(src);
      title = "URL encoded — structure kept";
    } else {
      res = o.plus ? encodeURIComponent(src).replace(/%20/g, "+") : encodeURIComponent(src);
      title = "Value encoded";
    }
    const changed = res !== src;
    DP.textResult(out, {
      title: changed ? title : "Nothing to change",
      text: res,
      filename: "url-encoded.txt",
      meta: changed ? `${src.length} → ${res.length} characters` : "the string was already clean"
    });
  }));
})();
