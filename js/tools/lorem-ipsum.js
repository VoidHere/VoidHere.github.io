/* Lorem Ipsum — placeholder text that actually reads like the classic. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The dose" }));
  side.append(panel);
  const optHost = el("div"); panel.append(optHost);
  const chosen = DP.options(optHost, [
    { k: "paras", type: "number", label: "Paragraphs", value: 3, min: 1, max: 30 },
    { k: "per", type: "number", label: "Sentences per paragraph", value: 5, min: 1, max: 20 },
    { k: "format", type: "seg", label: "Format", value: "plain", options: [
      { v: "plain", label: "Plain text" }, { v: "html", label: "HTML <p>" }, { v: "md", label: "Markdown" } ] },
    { k: "classic", type: "check", label: "Open with the classic line", value: true,
      hint: "\"Lorem ipsum dolor sit amet…\" — the way Cicero never wrote it." }
  ]);
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "Built from the real vocabulary of the standard passage, so the text has the familiar rhythm — roughly right word lengths, commas in sensible places. Not random dictionary noise." }));
  side.append(note);

  const out = el("div", { style: "margin-top:18px" });
  const runBtn = el("button", { class: "btn btn--primary", type: "button" }, "Generate");
  runBtn.dataset.busy = "Consulting Cicero…";
  app.append(el("div", { class: "btn-row", style: "margin-top:18px" }, runBtn));
  app.append(out);

  const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc feugiat suscipit varius vitae congue mauris rhoncus aenean vel eleifend donec pretium vulputate sapien nec sagittis hendrerit dignissim cras arcu felis bibendum ut tristique egestas purus viverra accumsan tortor posuere ac lobortis".split(" ");
  const CLASSIC = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.".split(" ");
  const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

  function sentence() {
    const len = 7 + rnd(9);
    const ws = Array.from({ length: len }, () => WORDS[rnd(WORDS.length)]);
    let s = ws.join(" ");
    if (len > 10 && rnd(2)) {
      const cut = 3 + rnd(len - 6);
      s = ws.slice(0, cut).join(" ") + ", " + ws.slice(cut).join(" ");
    }
    return s[0].toUpperCase() + s.slice(1) + (rnd(4) === 0 ? "?" : ".");
  }

  runBtn.addEventListener("click", () => DP.busy(runBtn, async () => {
    const o = chosen.read();
    const paras = [];
    for (let p = 0; p < Math.max(1, Math.min(30, Math.round(o.paras))); p++) {
      const n = Math.max(1, Math.min(20, Math.round(o.per)));
      const ss = Array.from({ length: n }, sentence);
      if (p === 0 && o.classic) {
        ss[0] = CLASSIC.map((w, i) => (i === 0 ? "Lorem" : w)).join(" ")
          .replace("amet,", "amet,")
          .replace("elit,", "elit,");
        ss[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
      }
      paras.push(ss.join(" "));
    }
    let text, mime, filename;
    if (o.format === "html") {
      text = paras.map(p => "  <p>" + p + "</p>").join("\n");
      mime = "text/html"; filename = "lorem.html";
    } else if (o.format === "md") {
      text = paras.join("\n\n");
      filename = "lorem.md";
    } else {
      text = paras.join("\n\n");
      filename = "lorem.txt";
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    DP.textResult(out, {
      title: `${DP.plural(paras.length, "paragraph")}, ${DP.plural(words, "word")}`,
      text, mime, filename,
      meta: o.format === "html" ? "HTML paragraphs" : o.format === "md" ? "markdown source" : "plain text"
    });
  }));
})();
