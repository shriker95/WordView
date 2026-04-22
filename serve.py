import http.server
import socketserver
import webbrowser
import urllib.request
import urllib.error

PORT = 8000
PROXY_PREFIX = '/api/'
UPSTREAM     = 'https://api.adsb.lol/'

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self._proxy(UPSTREAM + self.path[len(PROXY_PREFIX):])
        else:
            super().do_GET()

    def _proxy(self, url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'WorldView/1.0'})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
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
        if not self.path.startswith(PROXY_PREFIX):
            super().log_message(fmt, *args)

Handler.extensions_map['.js'] = 'application/javascript'

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    url = f'http://localhost:{PORT}'
    print(f'Serving at {url}  (Ctrl+C to stop)')
    webbrowser.open(url)
    httpd.serve_forever()
