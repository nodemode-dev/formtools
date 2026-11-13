#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("FORMTOOLS_URL", "http://127.0.0.1:" + os.environ.get("FORMTOOLS_PORT", "8240")).rstrip("/")
USAGE = """usage: ./formtools cli COMMAND

  info PATH    image facts from the engine (size, format, colour profile, EXIF)
  list DIR     the files and folders in DIR
  convert [--preset NAME | --config FILE] [--format F] [--quality Q] [--out DIR] [--naming T] [--recursive] INPUTS...
               batch convert pictures and wait for the job
  resize --longest N [--out DIR] INPUTS...
               shrink pictures so the longest side is at most N pixels
  rename --find A [--replace B] [--regex] [--counter] [--apply] PATHS...
               print the rename plan, or apply it with --apply (prints an undo id)
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
            return json.load(f).get("version") or "0.6.3"
    except (OSError, ValueError):
        return "0.6.3"


def get(route, **query):
    return call("GET", route, None, **query)


def call(method, route, body, **query):
    url = BASE + route
    if query:
        url += "?" + urllib.parse.urlencode(query)
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {} if data is None else {"Content-Type": "application/json"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=600) as r:
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


def parser_for(name, text):
    return argparse.ArgumentParser(prog="formtools cli " + name, description=text)


def absolute_paths(items):
    return [os.path.abspath(os.path.expanduser(item)) for item in items]


def wait_for(job):
    seen = None
    try:
        while job["state"] == "running":
            time.sleep(0.25)
            job = get("/api/jobs/" + job["id"])
            mark = (job["done"], job["current"])
            if mark != seen:
                seen = mark
                print(f"{job['done']}/{job['total']} {job['current']}", flush=True)
    except KeyboardInterrupt:
        call("POST", "/api/jobs/" + job["id"] + "/cancel", {})
        print("cancelling", file=sys.stderr)
        sys.exit(130)
    result = job.get("result") or {}
    print(f"{job['state']}: {result.get('written', 0)} written, {result.get('skipped', 0)} skipped, {result.get('failed', 0)} failed")
    for item in job.get("errors", []):
        print(f"  failed {item['path']}: {item['error']}", file=sys.stderr)
    for path in result.get("outputs", [])[:5]:
        print("  wrote " + path)
    if len(result.get("outputs", [])) > 5:
        print("  ...")
    if job["state"] != "done" or result.get("failed"):
        sys.exit(1)


def start_batch(body):
    job = call("POST", "/api/batch/run", body)
    print(f"job {job['id']}: {job['title']}", flush=True)
    wait_for(job)


def run_convert(rest):
    p = parser_for("convert", "Batch convert pictures.")
    p.add_argument("--preset")
    p.add_argument("--config")
    p.add_argument("--format")
    p.add_argument("--quality", type=int)
    p.add_argument("--out")
    p.add_argument("--naming")
    p.add_argument("--recursive", action="store_true")
    p.add_argument("inputs", nargs="*")
    a = p.parse_args(rest)
    body = {"actions": [], "output": {}, "recursive": False, "extensions": []}
    if a.preset:
        found = [x for x in get("/api/batch/presets").get("presets", []) if x["name"].lower() == a.preset.lower()]
        if not found:
            print(f"formtools: there is no preset named {a.preset}", file=sys.stderr)
            sys.exit(1)
        body["actions"], body["output"] = found[0]["actions"], found[0]["output"]
    if a.config:
        try:
            with open(os.path.expanduser(a.config), encoding="utf-8") as f:
                body.update(json.load(f))
        except (OSError, ValueError) as exc:
            print(f"formtools: cannot read the config file: {exc}", file=sys.stderr)
            sys.exit(1)
    inputs = absolute_paths(a.inputs) or body.get("inputs") or []
    if not inputs:
        print("formtools: give at least one input file or folder", file=sys.stderr)
        sys.exit(2)
    body["inputs"] = inputs
    if a.format:
        body["output"]["format"] = a.format
    if a.quality:
        body["output"]["quality"] = a.quality
    if a.out:
        body["output"]["folder"] = os.path.abspath(os.path.expanduser(a.out))
    if a.naming:
        body["output"]["naming"] = a.naming
    if a.recursive:
        body["recursive"] = True
    start_batch(body)


def run_resize(rest):
    p = parser_for("resize", "Resize pictures so the longest side is at most N pixels.")
    p.add_argument("--longest", type=int, required=True)
    p.add_argument("--out")
    p.add_argument("inputs", nargs="+")
    a = p.parse_args(rest)
    output = {"format": "same", "folder": "", "naming": "{name}-resized", "overwrite": "rename"}
    if a.out:
        output.update(folder=os.path.abspath(os.path.expanduser(a.out)), naming="{name}")
    start_batch(
        {
            "inputs": absolute_paths(a.inputs),
            "actions": [{"id": "resize", "params": {"mode": "longest", "value": a.longest, "upscale": False}}],
            "output": output,
        }
    )


def run_rename(rest):
    p = parser_for("rename", "Print or apply a bulk rename.")
    p.add_argument("--find")
    p.add_argument("--replace", default="")
    p.add_argument("--regex", action="store_true")
    p.add_argument("--counter", action="store_true")
    p.add_argument("--apply", action="store_true")
    p.add_argument("paths", nargs="+")
    a = p.parse_args(rest)
    rules = []
    if a.find:
        rules.append({"type": "replace", "find": a.find, "replace": a.replace, "regex": a.regex, "all": True})
    if a.counter:
        rules.append({"type": "counter", "start": 1, "step": 1, "pad": 3, "position": "end", "separator": "_"})
    if not rules:
        print("formtools: give --find and or --counter", file=sys.stderr)
        sys.exit(2)
    body = {"paths": absolute_paths(a.paths), "rules": rules}
    plan = call("POST", "/api/rename/plan", body)["items"]
    for item in plan:
        if not item["changed"]:
            print(f"{item['src']}  (unchanged)")
        else:
            note = "" if item["conflict"] == "none" else f"  [{item['conflict']}]"
            print(f"{item['src']} -> {os.path.basename(item['dst'])}{note}")
    changed = [item for item in plan if item["changed"]]
    print(f"{len(changed)} of {len(plan)} names change")
    if a.apply:
        done = call("POST", "/api/rename/apply", body)
        print(f"renamed {done['renamed']}")
        if done.get("undo"):
            print("undo: " + done["undo"])
    elif changed:
        print("nothing was renamed; add --apply to do it")


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
    elif command == "convert":
        run_convert(rest)
    elif command == "resize":
        run_resize(rest)
    elif command == "rename":
        run_rename(rest)
    else:
        print(USAGE, file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
