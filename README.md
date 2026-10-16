# DigitPDF

Offline, browser-based file tools — 69 of them — served as a plain static site.
No servers, no uploads, no CDN: every conversion happens inside the visitor's
browser. Live at **https://digitpdf.pages.dev** (with a mirror on GitHub Pages,
`https://voidhere.github.io`; a free clean URL, `digitpdf.is-a.dev`, is in
review — see Deploy below).

## What's here

| Area | Count | What |
| --- | --- | --- |
| PDF | 15 | merge, split, extract/remove/reorder pages, rotate, compress, to JPG/PNG, to text, to Word, images→PDF, watermark, page numbers, metadata |
| Image | 15 | convert, compress, resize, crop, rotate, flip, watermark, favicon set, SVG→PNG, HEIC→JPG, TIFF→PNG, image↔base64, EXIF view/strip |
| Media | 9 | video→frames/GIF/audio, compress, trim, convert (MP4/WebM/MKV), mute, audio convert, audio trim |
| Text & data | 20 | JSON/CSV/Excel converters, Markdown↔HTML, diff, regex, case, word count, cleaner, base64, URL, HTML entities, hashes, UUIDs, passwords, lorem, timestamps |
| Utilities | 10 | QR generate/read, barcodes, zip create/extract, gzip, OCR, unit/base/colour converters |

## Layout

```
digitpdf/
  *.html              the generated site — one page per tool + 8 site pages
  css/style.css       the whole design system
  js/core.js          shared runtime (dropzones, options, results, ffmpeg, helpers)
  js/tools/*.js       one script per tool, all lazy
  vendor/             every library, font and wasm bundle (vendored, versioned)
  favicon.svg
  robots.txt  sitemap.xml
  build/              the generator and the dev scripts (not deployed)
    generate.py       builds all HTML from defs/ + pages/ + partials/ + templates/
    defs/*.json       the single source of truth: tool metadata and page copy
    fetch-vendor.ps1  re-downloads vendor assets
    serve.py          local dev server (no-store; has a dev-only /__save)
    check-site.py     verifies links, offline-ness, script wiring, sitemap
    make-assets.py    builds the small text/zip test fixtures
    package-cf.sh     builds dist/ for Cloudflare Pages (drops the 31 MB wasm)
    deploy-cf.ps1     uploads dist/ to Cloudflare Pages (no Node needed)
    asset-hashes.py   wrangler-compatible asset hashes (needs blake3)
  test-assets/        fixtures used while testing (not deployed)
```

## Build

```powershell
python build/generate.py        # regenerate every *.html from build/defs
python build/check-site.py      # link / wiring / sitemap sanity check
```

Requires only Python 3 — no Node, no bundler. Edit copy in `build/defs/*.json`
and `build/pages/*`, then re-run the generator.

## Preview locally

```powershell
python build/serve.py           # http://127.0.0.1:8123, cache disabled
```

## Deploy

The site is served from **Cloudflare Pages** at **https://digitpdf.pages.dev**
(project `digitpdf`, direct upload). GitHub Pages keeps a mirror at
`https://voidhere.github.io`; pages.dev loads the 31 MB ffmpeg engine from that
mirror, because Cloudflare Pages rejects files over 25 MiB (see `WASM_ORIGIN`
in `js/core.js`).

```powershell
python build/generate.py                       # after editing defs/pages
python build/check-site.py                     # sanity check
git add -A; git commit -m "…"; git push        # GitHub Pages mirror rebuilds

& 'F:\PortableGit\bin\bash.exe' -c "bash build/package-cf.sh"   # builds dist/
powershell -File build\deploy-cf.ps1                            # deploys dist/
```

`build/deploy-cf.ps1` talks to Cloudflare's own upload API — no Node or wrangler
needed. It requests an upload token, computes wrangler-compatible asset hashes
(`build/asset-hashes.py`, blake3 of base64 content + extension), uploads only
the assets the store is missing, then creates the production deployment. It
needs the API token in `test-assets/cf_token.txt` (gitignored) or
`$env:CLOUDFLARE_API_TOKEN`, plus python with blake3 available
(`python -m pip install --target test-assets/pylib blake3`).

Pushing to `main` also triggers `.github/workflows/deploy-pages.yml`, which
packages and deploys the same way with `wrangler-action` on Cloudflare's
runners.

`SITE_URL` at the top of `build/generate.py` holds the public address used by
canonical tags, Open Graph and the sitemap. To attach a custom domain later
(e.g. the free `digitpdf.is-a.dev` — requested via github.com/is-a-dev/register
PR #56913, or a purchased `digitpdf.io`): add the domain to the Pages project
(`POST /accounts/<id>/pages/projects/digitpdf/domains`), point a CNAME at
`digitpdf.pages.dev` with the DNS provider, then set `SITE_URL`, regenerate,
commit, push, and re-run the deploy.

Any other static host works too — upload everything except `build/` and
`test-assets/`.

## Notes

- **ffmpeg**: the media tools lazily load a ~31 MB wasm engine once per visit
  (`DP.ffmpeg()` in `js/core.js`). This build's MJPEG and VP9 encoders are
  broken, so frame extraction goes PNG → canvas (JPG) and WebM encodes use VP8.
  Numeric ffmpeg arguments are stringified centrally for the same reason.
- **OCR**: tesseract.js runs in a blob worker, so its worker/core/lang paths
  must be absolute URLs. English data ships in `vendor/`; Urdu/Arabic/Hindi are
  optional downloads on top.
- **HEIC**: decoding uses heic2any (libheif in wasm), loaded only on that page.
- All state lives in the page; nothing is uploaded anywhere, ever.
