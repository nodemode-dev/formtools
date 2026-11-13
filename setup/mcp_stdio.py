#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = os.environ.get("FORMTOOLS_PORT", "8240")
DEFAULT_URL = f"http://127.0.0.1:{PORT}/mcp"
URL = os.environ.get("FORMTOOLS_MCP_URL", DEFAULT_URL)
session = ""
started = False
found = ""


def read_version():
    try:
        with open(os.path.join(ROOT, "frontend", "src", "version.ts"), encoding="utf-8") as f:
            found = re.search(r"VERSION = '([^']+)'", f.read())
            if found:
                return found.group(1)
    except OSError:
        pass
    try:
        with open(os.path.join(ROOT, "frontend", "package.json"), encoding="utf-8") as f:
            return json.load(f).get("version") or "0.8.0"
    except (OSError, ValueError):
        return "0.8.0"


def base():
    return URL.rsplit("/mcp", 1)[0]


def answering():
    try:
        with urllib.request.urlopen(base() + "/api/health", timeout=2) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError):
        return False


def data_dir():
    raw = os.environ.get("FORMTOOLS_DATA_DIR", "").strip()
    if raw:
        return os.path.expanduser(raw)
    home = os.path.expanduser("~")
    if sys.platform == "darwin":
        return os.path.join(home, "Library", "Application Support", "formtools")
    if os.name == "nt":
        return os.path.join(os.environ.get("APPDATA") or os.path.join(home, "AppData", "Roaming"), "formtools")
    xdg = os.environ.get("XDG_DATA_HOME") or ""
    return os.path.join(xdg if os.path.isabs(xdg) else os.path.join(home, ".local", "share"), "formtools")


def find_engine():
    global URL, found
    if URL not in (DEFAULT_URL, found):
        return False
    URL = DEFAULT_URL
    try:
        with open(os.path.join(data_dir(), "engine.port"), encoding="utf-8") as f:
            port = int(json.load(f).get("port", 0))
    except (OSError, ValueError, AttributeError, TypeError):
        return False
    if not 0 < port < 65536:
        return False
    found = URL = f"http://127.0.0.1:{port}/mcp"
    if answering():
        print(f"[formtools mcp] using the running engine at {URL}", file=sys.stderr, flush=True)
        return True
    URL = DEFAULT_URL
    return False


def start_engine():
    global started
    if started or URL != DEFAULT_URL or os.environ.get("FORMTOOLS_MCP_AUTOSTART", "1") == "0":
        return False
    started = True
    command = "serve" if os.path.isfile(os.path.join(ROOT, "frontend", "dist", "index.html")) else "backend"
    launcher = os.path.join(ROOT, "formtools.bat" if os.name == "nt" else "formtools")
    log = open(os.path.join(tempfile.gettempdir(), "formtools-engine.log"), "ab")
    print(f"[formtools mcp] starting the engine ({command}); log: {log.name}", file=sys.stderr, flush=True)
    try:
        subprocess.Popen([launcher, command], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                         start_new_session=(os.name != "nt"), creationflags=(0x208 if os.name == "nt" else 0))
    except OSError as exc:
        print(f"[formtools mcp] the engine could not start: {exc}", file=sys.stderr, flush=True)
        return False
    for _ in range(120):
        time.sleep(0.5)
        if answering():
            return True
    return False


def error_reply(msg, text):
    if msg.get("id") is None:
        return None
    return json.dumps({"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32000, "message": text}})


def forward(line, retry=True):
    global session
    try:
        msg = json.loads(line)
    except ValueError:
        return json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if session:
        headers["Mcp-Session-Id"] = session
    req = urllib.request.Request(URL, data=line.encode("utf-8"), method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=660) as r:
            body = r.read().decode("utf-8")
            session = r.headers.get("Mcp-Session-Id") or session
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8") or ""
    except (urllib.error.URLError, OSError) as exc:
        print(f"[formtools mcp] the engine is not answering at {URL}: {exc}", file=sys.stderr, flush=True)
        if retry and (find_engine() or start_engine()):
            return forward(line, False)
        return error_reply(msg, "The formtools engine is not running and could not be started: run ./formtools boot in the formtools folder, then retry.")
    if msg.get("id") is None:
        return None
    return body.strip() or None


def main():
    global URL
    for stream in (sys.stdin, sys.stdout):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(prog="formtools mcp", description="formtools over MCP's stdio transport")
    parser.add_argument("--url", help="the engine's /mcp address (default " + DEFAULT_URL + ")")
    parser.add_argument("--where", action="store_true", help="print the launcher, script and URL, then exit")
    parser.add_argument("--version", action="store_true", help="print the version, then exit")
    args = parser.parse_args()
    if args.url:
        URL = args.url
    if args.version:
        print("formtools " + read_version())
        return
    if args.where:
        launcher = os.path.join(ROOT, "formtools.bat" if os.name == "nt" else "formtools")
        print(json.dumps({"launcher": launcher, "script": os.path.abspath(__file__), "url": URL,
                          "claude_desktop": {"mcpServers": {"formtools": {"command": launcher, "args": ["mcp"]}}}}, indent=2))
        return
    for line in sys.stdin:
        if not line.strip():
            continue
        out = forward(line)
        if out:
            sys.stdout.write(out + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
