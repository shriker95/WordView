import http.server
import socketserver
import webbrowser

PORT = 8000

handler = http.server.SimpleHTTPRequestHandler
handler.extensions_map['.js'] = 'application/javascript'

with socketserver.TCPServer(('', PORT), handler) as httpd:
    url = f'http://localhost:{PORT}'
    print(f'Serving at {url}  (Ctrl+C to stop)')
    webbrowser.open(url)
    httpd.serve_forever()
