#!/usr/bin/env python3
"""
ローカル開発用 no-cache サーバ
- ブラウザ・プレビュー双方のキャッシュを完全無効化
- 起動: python3 dev-server.py
- URL: http://localhost:8090/editor-icons.html
"""
import http.server
import socketserver

PORT = 8090

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # 日本語のHTML/JS/テキストが文字化けしないよう、UTF-8を明示する
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'🚀 No-cache server: http://localhost:{PORT}/editor-icons.html')
        httpd.serve_forever()
