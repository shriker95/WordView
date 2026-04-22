import http.server
import socketserver
import webbrowser
import urllib.request
import urllib.error

PORT = 8000

# Prefix-based proxies: /prefix/rest → upstream + rest
PREFIX_PROXIES = {
    '/api/': ('https://api.adsb.lol/', 'application/json'),
}

# Exact-path proxies: /path → upstream url
EXACT_PROXIES = {
    '/satnogs': ('https://db.satnogs.org/api/tle/?format=json', 'application/json'),
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]  # strip query string for matching

        if path in EXACT_PROXIES:
            url, ctype = EXACT_PROXIES[path]
            self._proxy(url, ctype)
            return

        for prefix, (upstream, ctype) in PREFIX_PROXIES.items():
            if self.path.startswith(prefix):
                self._proxy(upstream + self.path[len(prefix):], ctype)
                return

        super().do_GET()

    def _proxy(self, url, content_type):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'WorldView/1.0'})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = r.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
        except Exception:
            self.send_response(502)
            self.end_headers()

    def log_message(self, fmt, *args):
        proxy_paths = tuple(EXACT_PROXIES) + tuple(PREFIX_PROXIES)
        if not any(self.path.startswith(p) for p in proxy_paths):
            super().log_message(fmt, *args)

Handler.extensions_map['.js'] = 'application/javascript'

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    url = f'http://localhost:{PORT}'
    print(f'Serving at {url}  (Ctrl+C to stop)')
    webbrowser.open(url)
    httpd.serve_forever()
