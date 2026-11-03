#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("FORMTOOLS_URL", "http://127.0.0.1:" + os.environ.get("FORMTOOLS_PORT", "8240")).rstrip("/")
USAGE = """usage: ./formtools cli COMMAND

  info PATH    image facts from the engine (size, format, colour profile, EXIF)
  list DIR     the files and folders in DIR
  version      the launcher version and the engine's, when it is running

The engine must be running (./formtools boot). FORMTOOLS_URL overrides http://127.0.0.1:8240."""


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
            return json.load(f).get("version") or "0.2.0"
    except (OSError, ValueError):
        return "0.2.0"


def get(route, **query):
    url = BASE + route
    if query:
        url += "?" + urllib.parse.urlencode(query)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            message = json.loads(exc.read().decode("utf-8")).get("error")
        except (ValueError, AttributeError):
            message = None
        print(f"formtools: {message or exc.reason}", file=sys.stderr)
        sys.exit(1)
    except (urllib.error.URLError, OSError) as exc:
        print(f"formtools: the engine is not answering at {BASE}: {exc}. Start it with ./formtools boot.", file=sys.stderr)
        sys.exit(1)


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help", "help"):
        print(USAGE)
        return
    command, rest = args[0], args[1:]
    if command == "version":
        print("formtools " + read_version())
        try:
            with urllib.request.urlopen(BASE + "/api/health", timeout=2) as r:
                print("engine " + str(json.loads(r.read().decode("utf-8")).get("version")))
        except (urllib.error.URLError, OSError, ValueError):
            print("engine not running")
    elif command == "info" and len(rest) == 1:
        print(json.dumps(get("/api/image/info", path=os.path.abspath(os.path.expanduser(rest[0]))), indent=2, ensure_ascii=False))
    elif command == "list" and len(rest) == 1:
        print(json.dumps(get("/api/fs/list", path=os.path.abspath(os.path.expanduser(rest[0])), hidden="0"), indent=2, ensure_ascii=False))
    else:
        print(USAGE, file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
