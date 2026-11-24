import os
import re
import subprocess
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
REFUSAL_TEXT = "formtools answers this computer's own window and agents only"
CLOSED_URL = "http://127.0.0.1:9"


def app_version() -> str:
    text = (BACKEND / "app" / "__init__.py").read_text(encoding="utf-8")
    return re.search(r"__version__\s*=\s*['\"]([^'\"]+)['\"]", text).group(1)


def wait_for(client, job_id: str, until=("done", "failed", "cancelled"), limit: float = 5.0) -> dict:
    deadline = time.monotonic() + limit
    while True:
        reply = client.get(f"/api/jobs/{job_id}").json()
        if reply["state"] in until or time.monotonic() > deadline:
            return reply
        time.sleep(0.01)


def run_cli(args, cwd, extra_env=None) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("FORMTOOLS_")}
    env["FORMTOOLS_URL"] = CLOSED_URL
    env.update(extra_env or {})
    return subprocess.run([sys.executable, str(REPO / "setup" / "cli.py"), *args], cwd=str(cwd), env=env, capture_output=True, text=True, timeout=30)


import shutil
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def copy_setup(tmp: Path, version_ts: str | None = None, package: dict | None = None) -> Path:
    root = tmp / "copy"
    (root / "setup").mkdir(parents=True)
    for name in ("cli.py", "mcp_stdio.py", "mcpb.py"):
        shutil.copy2(REPO / "setup" / name, root / "setup" / name)
    shutil.copytree(REPO / "setup" / "mcpb", root / "setup" / "mcpb")
    (root / "frontend" / "src").mkdir(parents=True)
    shutil.copy2(REPO / "frontend" / "package.json", root / "frontend" / "package.json")
    if version_ts is not None:
        (root / "frontend" / "src" / "version.ts").write_text(f"export const VERSION = '{version_ts}';\n", encoding="utf-8")
    if package is not None:
        import json

        (root / "frontend" / "package.json").write_text(json.dumps(package), encoding="utf-8")
    return root


def run_program(script: Path, args, cwd, extra_env=None, stdin: str | None = None) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("FORMTOOLS_")}
    env["FORMTOOLS_URL"] = CLOSED_URL
    env["FORMTOOLS_MCP_URL"] = CLOSED_URL + "/mcp"
    env["FORMTOOLS_MCP_AUTOSTART"] = "0"
    env["FORMTOOLS_DATA_DIR"] = str(Path(cwd) / "no-data")
    env.update(extra_env or {})
    return subprocess.run([sys.executable, str(script), *args], cwd=str(cwd), env=env, capture_output=True, text=True, timeout=30, input=stdin)


@contextmanager
def engine_bridge(test_client):
    class Relay(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def relay(self, method):
            size = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(size) if size else None
            headers = {k: v for k, v in self.headers.items() if k.lower() in ("content-type", "accept", "mcp-session-id")}
            reply = test_client.request(method, self.path, content=body, headers=headers)
            self.send_response(reply.status_code)
            for key, value in reply.headers.items():
                if key.lower() not in ("content-length", "transfer-encoding", "connection"):
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(reply.content)))
            self.end_headers()
            self.wfile.write(reply.content)

        def do_GET(self):
            self.relay("GET")

        def do_POST(self):
            self.relay("POST")

    server = ThreadingHTTPServer(("127.0.0.1", 0), Relay)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
