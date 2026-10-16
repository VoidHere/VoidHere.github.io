# DigitPDF

Offline, browser-based file tools — 69 of them — served as a plain static site.
No servers, no uploads, no CDN: every conversion happens inside the visitor's
browser. Live at **https://voidhere.github.io** (the digitpdf.io domain can be
attached later — see Deploy below).

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

Live on **GitHub Pages** from the repo `VoidHere/VoidHere.github.io` (the repo
name matters — it makes the site serve from the domain root, which the absolute
paths `/css/…`, `/vendor/…` require).

```powershell
python build/generate.py        # after editing defs/pages
git add -A; git commit -m "…"   # commit the regenerated files
git push                        # Pages rebuilds automatically in ~1 minute
```

`SITE_URL` at the top of `build/generate.py` holds the public address used by
canonical tags, Open Graph and the sitemap. When the site moves to digitpdf.io:

1. Buy the domain, then add a `CNAME` file (contents: `digitpdf.io`) and re-run
   the deploy; set the custom domain in the repo's Pages settings.
2. At the registrar: four `A` records for `@` → `185.199.108.153`,
   `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and `www` → CNAME
   `voidhere.github.io`. Tick "Enforce HTTPS" once the certificate is issued.
3. Change `SITE_URL` to `https://digitpdf.io`, regenerate, commit, push.

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
