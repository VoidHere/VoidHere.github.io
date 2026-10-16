#!/usr/bin/env python3
"""DigitPDF static site generator.

Reads:  build/defs/*.json      tool definitions (the single source of truth)
        build/templates/*.html page templates
        build/partials/*.html  shared header / footer
        build/pages/*.html     hand-written pages (with {{HEADER}} etc.)

Writes: tool pages at the site root, all-tools.html, index.html,
        sitemap.xml, robots.txt

Run:    python build/generate.py
"""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

# The public address of the site. Currently the free GitHub Pages address;
# change it here (and re-run) when digitpdf.io is attached.
SITE_URL = "https://voidhere.github.io"

CATS = {
    "pdf":   {"name": "PDF",            "icon": "i-pdf",
              "dek": "Everything the PDF does — plus the things you wish it would. Merged, split, squeezed and converted, all on your machine."},
    "image": {"name": "Images",         "icon": "i-image",
              "dek": "Convert, resize, crop, compress, strip metadata. Your camera roll stays yours."},
    "media": {"name": "Video &amp; audio", "icon": "i-media",
              "dek": "The heavy lifting, done by a 31 MB video engine that only loads if you ask for it. Clips, frames, GIFs, sound."},
    "text":  {"name": "Text &amp; code", "icon": "i-text",
              "dek": "The unglamorous workhorses — formatters, converters and the occasional bit of text surgery."},
    "util":  {"name": "Everyday tools", "icon": "i-util",
              "dek": "Small things, done properly. QR codes, archives, OCR, unit maths."},
}
CAT_ORDER = ["pdf", "image", "media", "text", "util"]


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def load_defs():
    tools, slugs = [], {}
    for cat in CAT_ORDER:
        path = BUILD / "defs" / f"{cat}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for t in data:
            t["cat"] = cat
            slug = t["slug"]
            if slug in slugs:
                raise SystemExit(f"duplicate slug: {slug}")
            slugs[slug] = t
            tools.append(t)
    return tools, slugs


def card(t: dict, with_name: bool = False) -> str:
    cat = CATS[t["cat"]]
    text = t.get("card")
    if not text:
        first = re.split(r"(?<=[.!?])\s", t["dek"].strip())[0]
        text = first if len(first) <= 84 else first[:81].rsplit(" ", 1)[0] + "…"
    name_attr = f' data-name="{esc(" ".join(filter(None, [t["title"], t["slug"], t.get("meta", ""), text])))}"' if with_name else ""
    return (
        f'<a class="tcard" href="/{t["slug"]}.html"{name_attr}>'
        f'<span class="tcard__ico"><svg class="ic" aria-hidden="true"><use href="#{cat["icon"]}"/></svg></span>'
        f'<span class="tcard__t">{esc(t["title"])}</span>'
        f'<span class="tcard__d">{esc(text)}</span>'
        f'<span class="tcard__go"><svg class="ic ic--sm" aria-hidden="true"><use href="#i-arrow"/></svg></span>'
        f"</a>"
    )


def cat_section(cat: str, tools: list, with_name: bool = False) -> str:
    meta = CATS[cat]
    items = [t for t in tools if t["cat"] == cat]
    cards = "\n".join(card(t, with_name) for t in items)
    return (
        f'<section class="section" id="{cat}">\n'
        f'  <div class="cat-head"><h2><svg class="ic" aria-hidden="true"><use href="#{meta["icon"]}"/></svg>{meta["name"]}'
        f'<span class="count-chip">{len(items)} tools</span></h2></div>\n'
        f'  <p class="cat-dek">{meta["dek"]}</p>\n'
        f'  <div class="tgrid">{cards}</div>\n'
        f"</section>"
    )


def render_tool(t: dict, slugs: dict, tpl: str, header: str, footer: str, count: int) -> str:
    steps = "\n".join(
        f'    <li><div><b>{esc(s["b"])}</b><p>{esc(s["p"])}</p></div></li>' for s in t["steps"]
    )
    faq = "\n".join(
        f'      <details><summary>{esc(q["q"])}<svg class="ic ic--sm" aria-hidden="true"><use href="#i-plus"/></svg></summary>'
        f'<div class="a"><p>{esc(q["a"])}</p></div></details>'
        for q in t["faq"]
    )
    # related: listed ones first, topped up from the same category
    rel, seen = [], {t["slug"]}
    for slug in t.get("related", []):
        if slug in slugs and slug not in seen:
            rel.append(slugs[slug]); seen.add(slug)
    for other in slugs.values():
        if len(rel) >= 4:
            break
        if other["cat"] == t["cat"] and other["slug"] not in seen:
            rel.append(other); seen.add(other["slug"])
    related = "\n".join(card(r) for r in rel[:4])

    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": f"DigitPDF {t['title']}",
                "url": f"{SITE_URL}/{t['slug']}.html",
                "applicationCategory": "UtilitiesApplication",
                "operatingSystem": "Any",
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
                "description": t["meta"],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE_URL}/"},
                    {"@type": "ListItem", "position": 2, "name": CATS[t["cat"]]["name"].replace("&amp;", "&"),
                     "item": f"{SITE_URL}/index.html#{t['cat']}"},
                    {"@type": "ListItem", "position": 3, "name": t["title"]},
                ],
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": q["q"],
                     "acceptedAnswer": {"@type": "Answer", "text": q["a"]}}
                    for q in t["faq"]
                ],
            },
        ],
    }, ensure_ascii=False)

    libs = "\n".join(
        f'<script src="/vendor/{lib}" defer></script>' for lib in t.get("libs", [])
    )
    page = tpl
    for token, value in {
        "{{TITLE}}": esc(t["title"]), "{{META}}": esc(t["meta"]), "{{H1}}": esc(t["h1"]),
        "{{DEK}}": esc(t["dek"]), "{{SLUG}}": t["slug"],
        "{{CATNAME}}": CATS[t["cat"]]["name"], "{{CATKEY}}": t["cat"],
        "{{STEPS}}": steps, "{{FAQLIST}}": faq, "{{RELATED}}": related,
        "{{JSONLD}}": jsonld, "{{LIBS}}": libs,
        "{{TOOLCOUNT}}": str(count), "{{HEADER}}": header, "{{FOOTER}}": footer,
        "{{SITEURL}}": SITE_URL,
    }.items():
        page = page.replace(token, value)
    return page


def main():
    tools, slugs = load_defs()
    count = len(tools)
    header = (BUILD / "partials" / "header.html").read_text(encoding="utf-8").replace("{{TOOLCOUNT}}", str(count))
    footer = (BUILD / "partials" / "footer.html").read_text(encoding="utf-8").replace("{{TOOLCOUNT}}", str(count))
    tpl = (BUILD / "templates" / "tool.html").read_text(encoding="utf-8")

    # tool pages
    for t in tools:
        out = render_tool(t, slugs, tpl, header, footer, count)
        (ROOT / f"{t['slug']}.html").write_text(out, encoding="utf-8")

    # hand-written pages, with grids injected where marked
    for page_file in sorted((BUILD / "pages").glob("*.html")):
        page = page_file.read_text(encoding="utf-8")
        page = page.replace("{{HEADER}}", header).replace("{{FOOTER}}", footer).replace("{{TOOLCOUNT}}", str(count))
        page = page.replace("{{SITEURL}}", SITE_URL)
        for cat in CAT_ORDER:
            page = page.replace(f"<!--@TOOLS:{cat}-->", cat_section(cat, tools))
        # all-tools page: every section in order, cards carry data-name for the filter
        if "<!--@TOOLS:all-->" in page:
            sections = "\n".join(cat_section(c, tools, with_name=True) for c in CAT_ORDER)
            page = page.replace("<!--@TOOLS:all-->", sections)
        (ROOT / page_file.name).write_text(page, encoding="utf-8")

    # sitemap + robots
    urls = ["index.html", "all-tools.html", "about.html", "faq.html", "privacy.html",
            "terms.html", "contact.html"] + [f"{t['slug']}.html" for t in tools]
    today = date.today().isoformat()
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        loc = f"{SITE_URL}/" if u == "index.html" else f"{SITE_URL}/{u}"
        sitemap.append(f"  <url><loc>{loc}</loc><lastmod>{today}</lastmod></url>")
    sitemap.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sitemap), encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")

    # sanity warnings
    bad = 0
    for t in tools:
        for r in t.get("related", []):
            if r not in slugs:
                print(f"  ! {t['slug']}: unknown related slug '{r}'")
                bad += 1
    print(f"generated {count} tool pages + {len(list((BUILD/'pages').glob('*.html')))} site pages"
          f" + sitemap.xml + robots.txt ({'no' if not bad else bad} warnings)")


if __name__ == "__main__":
    main()
