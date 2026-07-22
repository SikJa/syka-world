from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .runtime import WorldRuntime


def make_handler(runtime: WorldRuntime):
    class Handler(BaseHTTPRequestHandler):
        server_version = "SykaWorldBridge/0.1"

        def _json(self, payload: dict, status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            if parsed.path == "/health":
                self._json({"ok": True, "service": "syka-world-bridge", "errors": len(runtime.errors)})
            elif parsed.path == "/api/world/state":
                self._json(runtime.snapshot())
            elif parsed.path == "/api/world/diagnostics":
                self._json(runtime.diagnostics())
            elif parsed.path == "/api/world/events":
                after = query.get("after", [None])[0]
                wait = min(float(query.get("wait", ["0"])[0]), 20.0)
                events = runtime.wait_for_events(after, wait) if wait > 0 else runtime.events_after(after)
                self._json({"schema": "syka.world.events.v1", "events": events})
            else:
                self._json({"error": "not_found"}, 404)

        def log_message(self, format: str, *args) -> None:
            return

    return Handler


def serve(runtime: WorldRuntime, host: str, port: int) -> None:
    runtime.scan_once()
    runtime.start()
    server = ThreadingHTTPServer((host, port), make_handler(runtime))
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        runtime.stop()
        server.server_close()
