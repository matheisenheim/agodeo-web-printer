import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        print('%s - %s' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8000), NoCacheHandler)
    print('http://localhost:8000  (Cache-Control: no-store — plus de 304 en dev)')
    server.serve_forever()
