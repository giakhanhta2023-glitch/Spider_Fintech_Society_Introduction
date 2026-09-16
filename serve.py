"""
Local development server for FinQuest.

Identical to `python -m http.server` except that it tells the browser never to
cache anything. Without that, ES modules and the curriculum files are held in
the browser's memory cache and an edit appears to do nothing until you force a
reload, which is confusing enough to look like a broken build.

Run:  python serve.py           (http://localhost:8000)
      python serve.py 8080      (a different port)
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # one tidy line per request instead of the default noise
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=".")
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"FinQuest running at http://localhost:{port}")
        print("Caching is disabled, so a normal refresh always shows your latest edit.")
        print("Stop with Ctrl+C.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
