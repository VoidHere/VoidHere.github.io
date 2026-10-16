import http.server
import os
import socketserver
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


class H(http.server.SimpleHTTPRequestHandler):
    def _resolve_clean(self):
        # production (GitHub Pages) serves /merge-pdf from merge-pdf.html;
        # mirror that locally so preview matches the live URL scheme
        path, _, query = self.path.partition("?")
        if not path or path.endswith("/"):
            return
        if "." in os.path.basename(path):
            return
        disk = self.translate_path(path)
        if not os.path.exists(disk) and os.path.isfile(disk + ".html"):
            self.path = path + ".html" + (("?" + query) if query else "")

    def do_GET(self):
        self._resolve_clean()
        super().do_GET()

    def do_HEAD(self):
        self._resolve_clean()
        super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_POST(self):
        # dev-only helper for the test suite: save a request body under the project
        if self.path.startswith("/__save"):
            q = parse_qs(urlparse(self.path).query)
            rel = (q.get("path") or [""])[0].replace("\\", "/").lstrip("/")
            target = os.path.abspath(os.path.join(ROOT, rel))
            if not target.startswith(os.path.abspath(ROOT) + os.sep) or not rel:
                body = b"bad path"
                self.send_response(400)
            else:
                length = int(self.headers.get("Content-Length") or 0)
                data = self.rfile.read(length)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "wb") as f:
                    f.write(data)
                body = ("saved %d bytes to %s" % (len(data), rel)).encode()
                self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", 8123), H) as httpd:
    print("serving", ROOT, "on http://127.0.0.1:8123")
    httpd.serve_forever()
