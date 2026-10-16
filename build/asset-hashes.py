#!/usr/bin/env python3
"""Print the Cloudflare Pages asset manifest (JSON: path -> hash) for a folder.

The hash has to match wrangler exactly, otherwise Pages accepts the uploads
but never serves them (content-addressed store):

    blake3( base64(file contents) + file-extension-without-dot ).hexdigest()[:32]

Requires the blake3 package. Local copy used by build/deploy-cf.ps1 lives in
the gitignored test-assets/pylib (install:
    python -m pip install --target test-assets/pylib blake3
and run with PYTHONPATH=test-assets/pylib).

Usage: python build/asset-hashes.py <dist-folder>
"""
import base64
import json
import sys
from pathlib import Path

try:
    from blake3 import blake3
except ImportError:  # pragma: no cover
    sys.exit(
        "blake3 package not found. Install it with:\n"
        "  python -m pip install --target test-assets/pylib blake3\n"
        "then run with PYTHONPATH=test-assets/pylib"
    )


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "dist").resolve()
    if not root.is_dir():
        sys.exit(f"not a folder: {root}")

    manifest = {}
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        rel = "/" + p.relative_to(root).as_posix()
        ext = p.suffix[1:]  # ".html" -> "html", ".nojekyll" -> ""
        digest = blake3(base64.b64encode(p.read_bytes()) + ext.encode("utf-8"))
        manifest[rel] = digest.hexdigest()[:32]

    json.dump(manifest, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
