"""Stands in for sim/runner/app.py in tests: same CLI and HTTP API, no Isaac Sim."""

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

p = argparse.ArgumentParser()
p.add_argument("--port", type=int, required=True)
p.add_argument("--headless", action="store_true")
args = p.parse_args()
state = {"scene": None, "error": None}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send(200, state)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)))
        with open(body["path"]) as f:  # the extracted scene must be readable
            f.read()
        state["scene"] = body["path"]
        self._send(202, state)


HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
