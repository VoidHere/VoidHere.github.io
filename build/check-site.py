"""Final sanity check for the generated site.

Verifies, for every *.html at the site root:
  * internal href/src targets exist on disk
  * nothing loads from the network (offline claim) except canonical/OG URLs
  * every page includes the shared css + core.js
  * every tool page includes its own script
Also checks robots.txt and sitemap.xml coverage.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# the public address is owned by the generator — read it from there
GEN = open(os.path.join(ROOT, "build", "generate.py"), encoding="utf-8").read()
SITE_URL = re.search(r'^SITE_URL = "([^"]+)"', GEN, re.M).group(1)

TOOL_SLUGS = sorted(
    f[:-5] for f in os.listdir(ROOT)
    if f.endswith(".html") and f not in {
        "index.html", "all-tools.html", "about.html", "faq.html",
        "privacy.html", "terms.html", "contact.html", "404.html",
    }
)
SITE_PAGES = ["index.html", "all-tools.html", "about.html", "faq.html",
              "privacy.html", "terms.html", "contact.html", "404.html"]

problems = []

def check_page(name):
    path = os.path.join(ROOT, name)
    src = open(path, encoding="utf-8").read()

    # resource references (src= and link/script href=)
    refs = re.findall(r'(?:href|src)="([^"]+)"', src)
    for ref in refs:
        if ref.startswith(("http://", "https://", "mailto:", "data:", "//", "#")):
            continue
        target = ref.split("#")[0].split("?")[0]
        if not target:
            continue
        disk = os.path.join(ROOT, target.lstrip("/"))
        if not os.path.exists(disk):
            problems.append(f"{name}: missing target {ref}")

    # offline check: external URLs may only be the site's own address
    for u in re.findall(r'(?:href|src)="(https?://[^"]+)"', src):
        if u.startswith(SITE_URL):
            continue
        problems.append(f"{name}: external resource {u}")

    for need in ("/css/style.css", "/js/core.js"):
        if need not in src:
            problems.append(f"{name}: missing {need}")

    if name in [s + ".html" for s in TOOL_SLUGS]:
        slug = name[:-5]
        if f"/js/tools/{slug}.js" not in src:
            problems.append(f"{name}: missing its own tool script")

    if name not in SITE_PAGES and name[:-5] not in TOOL_SLUGS:
        problems.append(f"{name}: unexpected page")

for page in SITE_PAGES + [s + ".html" for s in TOOL_SLUGS]:
    if not os.path.exists(os.path.join(ROOT, page)):
        problems.append(f"{page}: page missing")
        continue
    check_page(page)

# robots.txt
robots = open(os.path.join(ROOT, "robots.txt"), encoding="utf-8").read()
if "sitemap.xml" not in robots:
    problems.append("robots.txt: no sitemap reference")

# sitemap coverage
sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
locs = re.findall(r"<loc>([^<]+)</loc>", sitemap)
for page in SITE_PAGES[:-1] + [s + ".html" for s in TOOL_SLUGS]:
    url = f"{SITE_URL}/" if page == "index.html" else f"{SITE_URL}/{page}"
    if url not in locs:
        problems.append(f"sitemap.xml: missing {url}")

print(f"tool pages: {len(TOOL_SLUGS)}, site pages: {len(SITE_PAGES)}, sitemap urls: {len(locs)}")
if problems:
    print("\nPROBLEMS:")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print("all checks passed")
