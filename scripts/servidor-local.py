"""Servidor estático sin caché para verificar la app localmente."""
import http.server
import sys

class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8614
    with http.server.ThreadingHTTPServer(('', puerto), SinCache) as httpd:
        print(f'Sirviendo sin caché en http://localhost:{puerto}/')
        httpd.serve_forever()
