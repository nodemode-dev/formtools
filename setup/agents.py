#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, ".claude", "skills")
MIRROR = os.path.join(ROOT, ".agents", "skills")
SKIP_DIRS = {"__pycache__", "node_modules", ".git"}
SKIP_FILES = {".DS_Store"}
RESERVED = ("anthropic", "claude")
TAG = re.compile(r"</?[A-Za-z][^>]*>")
LAUNCHER = "formtools"
MANIFEST = os.path.join(ROOT, "agents", "manifest.json")
MANIFEST_REL = "agents/manifest.json"
APP = "formtools"
DOCK = {"present": True, "positions": ["bottom", "right"], "tabs": ["chat", "shell", "claude", "codex", "cursor", "antigravity"]}
DOCK_DIR = os.path.join(ROOT, "frontend", "src", "dock")
DOCK_REL = "frontend/src/dock"
DOCK_VERSION = "2.2.0"
LOOKUP = os.path.join(ROOT, "backend", "app", "services", "agent_lookup.py")
LOOKUP_REL = "backend/app/services/agent_lookup.py"
LOOKUP_HASHES = {"1.0.0": "252ea9bb9419d4990f174f91914f09800497bc69e98f849f5643bbf4217cc3f3", "1.0.1": "62667f9b68b7d101e1896ce617240424e33b7e498c560bc79d45f0ab26c77d51"}
ENGINE_FACTS = """
import json
from app.main import app
from app.routers import mcp
from app.core import registry
from app.services import consent
if registry.failed():
    raise SystemExit("tool packages failed to load: " + ", ".join(sorted(registry.failed())))
tools = mcp.all_tools()
print(json.dumps({
    "tools": [t.name for t in tools],
    "read_only": [t.name for t in tools if t.annotations().get("readOnlyHint")],
    "approval_gated": [t.name for t in tools if consent.gated(t)],
    "http": "post" in app.openapi().get("paths", {}).get("/mcp", {}),
}))
"""


def files_under(base):
    found = {}
    if not os.path.isdir(base):
        return found
    for folder, dirs, names in os.walk(base):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(names):
            if name in SKIP_FILES or name.endswith(".pyc"):
                continue
            full = os.path.join(folder, name)
            found[os.path.relpath(full, base).replace(os.sep, "/")] = full
    return found


def read_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def is_bad_char(cp):
    return cp == 0x2014 or 0x1F000 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF or cp == 0xFE0F


def frontmatter(text):
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return None
    values = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return values
        found = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if found:
            value = found.group(2).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[found.group(1)] = value
    return None


def engine_python():
    for rel in (("backend", "venv", "bin", "python"), ("backend", "venv", "Scripts", "python.exe")):
        candidate = os.path.join(ROOT, *rel)
        if os.path.isfile(candidate):
            return candidate
    return sys.executable


def engine_facts():
    with tempfile.TemporaryDirectory(prefix="formtools-manifest-") as scratch:
        env = {**os.environ, "FORMTOOLS_DATA_DIR": scratch, "PYTHONDONTWRITEBYTECODE": "1"}
        done = subprocess.run([engine_python(), "-c", ENGINE_FACTS], cwd=os.path.join(ROOT, "backend"), env=env, capture_output=True, text=True)
    if done.returncode != 0:
        tail = (done.stderr.strip().splitlines() or ["no output"])[-1]
        raise RuntimeError("cannot read the MCP registry from the engine code (run ./formtools install, then again): " + tail)
    return json.loads(done.stdout.strip().splitlines()[-1])


def skill_entries():
    entries = []
    if not os.path.isdir(SOURCE):
        return entries
    for name in sorted(os.listdir(SOURCE)):
        folder = os.path.join(SOURCE, name)
        if not os.path.isfile(os.path.join(folder, "SKILL.md")):
            continue
        subs = os.path.join(folder, "sub-skills")
        found = sorted(d for d in os.listdir(subs) if os.path.isfile(os.path.join(subs, d, "SUB-SKILL.md"))) if os.path.isdir(subs) else []
        entries.append({"name": name, "sub_skills": found})
    return entries


def manifest_text():
    facts = engine_facts()
    transports = (["stdio"] if os.path.isfile(os.path.join(ROOT, "setup", "mcp_stdio.py")) else []) + (["http"] if facts["http"] else [])
    body = {
        "format": "form-agent-manifest",
        "version": 1,
        "app": APP,
        "mcp": {"tools": facts["tools"], "read_only": facts["read_only"], "approval_gated": facts["approval_gated"], "transports": transports},
        "skills": skill_entries(),
        "dock": DOCK,
        "extensions": None,
    }
    return json.dumps(body, indent=2) + "\n"


def manifest_current():
    try:
        return read_bytes(MANIFEST).decode("utf-8") == manifest_text()
    except OSError:
        return False


def write_manifest():
    wanted = manifest_text()
    try:
        if read_bytes(MANIFEST).decode("utf-8") == wanted:
            print(f"[agents] {MANIFEST_REL} is current")
            return
    except OSError:
        pass
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write(wanted)
    print(f"[agents] wrote {MANIFEST_REL}")


def check_manifest(problems):
    try:
        if not manifest_current():
            problems.append(f"{MANIFEST_REL} is not what ./formtools agents sync writes; run ./formtools agents sync")
    except RuntimeError as exc:
        problems.append(f"{MANIFEST_REL} could not be checked: {exc}")


def dock_problems():
    try:
        kept = json.loads(read_bytes(os.path.join(DOCK_DIR, "MANIFEST.json")).decode("utf-8"))
    except (OSError, ValueError):
        return [f"{DOCK_REL}/MANIFEST.json is missing or not JSON"]
    if kept.get("module") != "dock" or kept.get("version") != DOCK_VERSION:
        return [f"{DOCK_REL}/MANIFEST.json is not the dock module {DOCK_VERSION}"]
    files = kept.get("files") or {}
    now = {name: hashlib.sha256(read_bytes(os.path.join(DOCK_DIR, name))).hexdigest() for name in sorted(os.listdir(DOCK_DIR)) if name != "MANIFEST.json" and os.path.isfile(os.path.join(DOCK_DIR, name))}
    return [f"{DOCK_REL}/{name} does not match MANIFEST.json; the shared dock module is copied whole from FormVis, never edited here" for name in sorted(set(files) | set(now)) if files.get(name) != now.get(name)]


def lookup_problems():
    try:
        raw = read_bytes(LOOKUP)
    except OSError:
        return [f"{LOOKUP_REL}: missing (the shared finder for the agent programs)"]
    said = re.search(rb'^VERSION = "([^"\r\n]+)"\r?$', raw, re.M)
    version = said.group(1).decode("ascii", "replace") if said else "unknown"
    if LOOKUP_HASHES.get(version) != hashlib.sha256(raw).hexdigest():
        return [f"{LOOKUP_REL}: does not match the hash recorded for version {version} (the shared finder changes only as a whole new version)"]
    return []


def lookup():
    import importlib.util

    spec = importlib.util.spec_from_file_location("formtools_agent_lookup", LOOKUP)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def sync():
    write_manifest()
    if not os.path.isdir(SOURCE):
        print("[agents] .claude/skills is missing", file=sys.stderr)
        return 1
    source = files_under(SOURCE)
    mirror = files_under(MIRROR)
    changed = 0
    for rel in sorted(mirror):
        if rel not in source:
            os.remove(mirror[rel])
            print(f"[agents] removed {rel}")
            changed += 1
    for rel in sorted(source):
        target = os.path.join(MIRROR, rel)
        if rel in mirror and read_bytes(mirror[rel]) == read_bytes(source[rel]):
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(source[rel], target)
        print(f"[agents] wrote {rel}")
        changed += 1
    for folder, dirs, names in os.walk(MIRROR, topdown=False):
        if folder != MIRROR and not os.listdir(folder):
            os.rmdir(folder)
    print(f"[agents] .agents/skills mirrors .claude/skills ({len(source)} files, {changed} changed)")
    problems = lookup_problems()
    for line in problems:
        print(f"[agents] {line}", file=sys.stderr)
    return 1 if problems else 0


def check_drift(problems):
    source = files_under(SOURCE)
    mirror = files_under(MIRROR)
    for rel in sorted(set(source) | set(mirror)):
        if rel not in mirror:
            problems.append(f".agents/skills/{rel} is missing; run ./formtools agents sync")
        elif rel not in source:
            problems.append(f".agents/skills/{rel} is stale; run ./formtools agents sync")
        elif read_bytes(source[rel]) != read_bytes(mirror[rel]):
            problems.append(f".agents/skills/{rel} differs from .claude/skills; run ./formtools agents sync")


def check_skill_format(problems):
    if not os.path.isdir(SOURCE):
        problems.append(".claude/skills is missing")
        return
    skills = sorted(d for d in os.listdir(SOURCE) if os.path.isdir(os.path.join(SOURCE, d)))
    if not skills:
        problems.append(".claude/skills holds no skill folder")
    for skill in skills:
        path = os.path.join(SOURCE, skill, "SKILL.md")
        label = f".claude/skills/{skill}/SKILL.md"
        if not os.path.isfile(path):
            problems.append(f"{label} is missing")
            continue
        text = read_bytes(path).decode("utf-8", errors="replace")
        if len(text.split("\n")) - (1 if text.endswith("\n") else 0) >= 500:
            problems.append(f"{label} has 500 lines or more")
        meta = frontmatter(text)
        if meta is None:
            problems.append(f"{label} has no frontmatter")
            continue
        name = meta.get("name", "")
        description = meta.get("description", "")
        if not name:
            problems.append(f"{label} has no name")
        else:
            if len(name) > 64:
                problems.append(f"{label} name is longer than 64 characters")
            if name != skill:
                problems.append(f"{label} name '{name}' does not match its folder '{skill}'")
            if any(word in name.lower() for word in RESERVED):
                problems.append(f"{label} name holds a reserved word")
            if TAG.search(name):
                problems.append(f"{label} name holds an XML tag")
        if not description:
            problems.append(f"{label} has no description")
        else:
            if len(description) > 1024:
                problems.append(f"{label} description is longer than 1024 characters")
            if TAG.search(description):
                problems.append(f"{label} description holds an XML tag")
    for rel, full in sorted(files_under(SOURCE).items()):
        try:
            text = read_bytes(full).decode("utf-8")
        except UnicodeDecodeError:
            continue
        for ch in text:
            if is_bad_char(ord(ch)):
                problems.append(f".claude/skills/{rel} holds U+{ord(ch):04X}")
                break


def load_json(rel, problems):
    path = os.path.join(ROOT, rel)
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        problems.append(f"{rel} is missing")
    except ValueError as exc:
        problems.append(f"{rel} is not valid JSON: {exc}")
    return None


def check_server(rel, server, problems):
    if not isinstance(server, dict):
        problems.append(f"{rel} has no {LAUNCHER} server")
        return
    command = server.get("command")
    args = server.get("args") or []
    if not isinstance(command, str) or not isinstance(args, list):
        problems.append(f"{rel} server needs a command and an args list")
        return
    if command == "sh":
        joined = " ".join(str(a) for a in args)
        if LAUNCHER not in joined or not joined.rstrip().endswith("mcp"):
            problems.append(f"{rel} must run the {LAUNCHER} launcher with mcp")
        return
    if os.path.basename(command) != LAUNCHER or args != ["mcp"]:
        problems.append(f"{rel} must name the {LAUNCHER} launcher with the argument mcp")


def check_agent_files(problems):
    import tomllib

    config = load_json(".mcp.json", problems)
    if config is not None:
        check_server(".mcp.json", (config.get("mcpServers") or {}).get(LAUNCHER), problems)
    config = load_json(".cursor/mcp.json", problems)
    if config is not None:
        check_server(".cursor/mcp.json", (config.get("mcpServers") or {}).get(LAUNCHER), problems)
    try:
        with open(os.path.join(ROOT, ".codex", "config.toml"), "rb") as f:
            toml = tomllib.load(f)
        check_server(".codex/config.toml", (toml.get("mcp_servers") or {}).get(LAUNCHER), problems)
    except OSError:
        problems.append(".codex/config.toml is missing")
    except tomllib.TOMLDecodeError as exc:
        problems.append(f".codex/config.toml is not valid TOML: {exc}")
    plugin = load_json(".claude-plugin/plugin.json", problems)
    if plugin is not None:
        skills = plugin.get("skills")
        if not isinstance(skills, list) or not skills:
            problems.append(".claude-plugin/plugin.json lists no skills")
        else:
            for entry in skills:
                target = os.path.normpath(os.path.join(ROOT, str(entry)))
                if not os.path.isfile(os.path.join(target, "SKILL.md")):
                    problems.append(f".claude-plugin/plugin.json skills path {entry} has no SKILL.md")
        check_server(".claude-plugin/plugin.json", (plugin.get("mcpServers") or {}).get(LAUNCHER), problems)


def check():
    problems = []
    check_drift(problems)
    check_skill_format(problems)
    check_agent_files(problems)
    check_manifest(problems)
    problems.extend(dock_problems())
    problems.extend(lookup_problems())
    if problems:
        for line in problems:
            print(f"[agents] {line}", file=sys.stderr)
        print(f"[agents] {len(problems)} problem(s)", file=sys.stderr)
        return 1
    print("[agents] clean: manifest is current, mirror matches, skills pass the format gate, MCP configs name the launcher")
    return 0


def launch():
    if os.name == "nt":
        return sys.executable, [os.path.join(ROOT, "setup", "mcp_stdio.py")]
    return os.path.join(ROOT, LAUNCHER), ["mcp"]


def user_skills():
    try:
        with open(os.path.join(ROOT, ".claude-plugin", "plugin.json"), encoding="utf-8") as f:
            listed = json.load(f).get("skills") or []
    except (OSError, ValueError):
        listed = []
    names = [os.path.basename(os.path.normpath(str(entry))) for entry in listed]
    return [name for name in names if os.path.isfile(os.path.join(SOURCE, name, "SKILL.md"))]


def same_tree(first, second):
    one, two = files_under(first), files_under(second)
    return one.keys() == two.keys() and all(read_bytes(one[rel]) == read_bytes(two[rel]) for rel in one)


def backup(path, dry):
    if os.path.exists(path) and not dry:
        shutil.copy2(path, path + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))


def copy_skills(root, dry, said):
    for name in user_skills():
        to = os.path.join(root, name)
        if os.path.isdir(to) and same_tree(to, os.path.join(SOURCE, name)):
            said.append(f"  skill already at {to}")
            continue
        said.append(f"  skill -> {to}")
        if not dry:
            shutil.rmtree(to, ignore_errors=True)
            os.makedirs(root, exist_ok=True)
            shutil.copytree(os.path.join(SOURCE, name), to)


def install_claude(home, dry, said):
    command, args = launch()
    line = subprocess.list2cmdline([command, *args])
    said.append("Claude Code:")
    finder = lookup()
    found = finder.check(finder.find("claude", override_vars=("FORMTOOLS_CLAUDE_BIN",), home=home))
    claude = found.path if found.state == "runs" else None
    if claude:
        env = finder.child_env(claude, home=home)
        have = finder.run([claude, "mcp", "get", LAUNCHER], env, 60)
        if have.returncode == 0 and command in have.stdout:
            said.append(f"  MCP server {LAUNCHER} already set (user scope)")
        else:
            said.append(f"  claude mcp add --scope user {LAUNCHER} -- {line}")
            if not dry:
                if have.returncode == 0:
                    finder.run([claude, "mcp", "remove", LAUNCHER, "--scope", "user"], env, 60)
                finder.run([claude, "mcp", "add", "--scope", "user", LAUNCHER, "--", command, *args], env, 60).check_returncode()
    else:
        said.append(f"  {finder.sentence(found, finder.install('claude'))} Once it runs: claude mcp add --scope user {LAUNCHER} -- {line}")
    copy_skills(os.path.join(home, ".claude", "skills"), dry, said)


def install_codex(home, dry, said):
    command, args = launch()
    said.append("Codex:")
    cfg = os.path.join(os.environ.get("CODEX_HOME") or os.path.join(home, ".codex"), "config.toml")
    block = f"[mcp_servers.{LAUNCHER}]\ncommand = {json.dumps(command, ensure_ascii=False)}\nargs = {json.dumps(args, ensure_ascii=False)}\nstartup_timeout_sec = 90\ntool_timeout_sec = 600\n"
    text = open(cfg, encoding="utf-8").read() if os.path.isfile(cfg) else ""
    found = re.search(rf"(?ms)^\[mcp_servers\.{LAUNCHER}\]\n.*?(?=^\[|\Z)", text)
    if found and found.group(0).strip() == block.strip():
        said.append(f"  MCP server {LAUNCHER} already in {cfg}")
    else:
        said.append(f"  MCP server {LAUNCHER} -> {cfg}")
        if not dry:
            backup(cfg, dry)
            os.makedirs(os.path.dirname(cfg), exist_ok=True)
            new = text[:found.start()] + block + "\n" + text[found.end():] if found else (text.rstrip("\n") + "\n\n" if text.strip() else "") + block
            with open(cfg, "w", encoding="utf-8") as f:
                f.write(new)
    copy_skills(os.path.join(home, ".agents", "skills"), dry, said)


def install_cursor(home, dry, said):
    command, args = launch()
    said.append("Cursor:")
    cfg = os.path.join(home, ".cursor", "mcp.json")
    text = open(cfg, encoding="utf-8").read() if os.path.isfile(cfg) else ""
    try:
        data = json.loads(text) if text.strip() else {}
    except ValueError:
        said.append(f"  {cfg} is not valid JSON; fix it, then run this again")
        return
    entry = {"command": command, "args": args}
    if (data.get("mcpServers") or {}).get(LAUNCHER) == entry:
        said.append(f"  MCP server {LAUNCHER} already in {cfg}")
    else:
        said.append(f"  MCP server {LAUNCHER} -> {cfg}")
        if not dry:
            backup(cfg, dry)
            data.setdefault("mcpServers", {})[LAUNCHER] = entry
            os.makedirs(os.path.dirname(cfg), exist_ok=True)
            with open(cfg, "w", encoding="utf-8") as f:
                f.write(json.dumps(data, indent=2) + "\n")
    copy_skills(os.path.join(home, ".agents", "skills"), dry, said)


def install_antigravity(home, dry, said):
    command, args = launch()
    said.append("Antigravity:")
    cfg = os.path.join(home, ".gemini", "config", "mcp_config.json")
    older = os.path.join(home, ".gemini", "antigravity-cli", "mcp_config.json")
    if os.path.exists(older) and not os.path.exists(cfg):
        said.append(f"  an older file was seen at {older} and left alone; the documented file is {cfg}")
    text = open(cfg, encoding="utf-8").read() if os.path.isfile(cfg) else ""
    try:
        data = json.loads(text) if text.strip() else {}
    except ValueError:
        data = None
    if not isinstance(data, dict) or not isinstance(data.get("mcpServers", {}), dict):
        said.append(f"  {cfg} is not an MCP servers file {LAUNCHER} can read; left alone")
        return
    entry = {"command": command, "args": args}
    have = data.get("mcpServers", {}).get(LAUNCHER)
    ours = isinstance(have, dict) and have.get("args") == args and os.path.basename(str(have.get("command", ""))) == os.path.basename(command)
    if have == entry:
        said.append(f"  MCP server {LAUNCHER} already in {cfg}")
    elif have is not None and not ours:
        said.append(f"  {cfg} has a server named {LAUNCHER} that {LAUNCHER} did not write; left alone")
    else:
        said.append(f"  MCP server {LAUNCHER} -> {cfg}")
        if not dry:
            backup(cfg, dry)
            data.setdefault("mcpServers", {})[LAUNCHER] = entry
            os.makedirs(os.path.dirname(cfg), exist_ok=True)
            part = f"{cfg}.part-{os.getpid()}"
            with open(part, "w", encoding="utf-8") as f:
                f.write(json.dumps(data, indent=2) + "\n")
            os.replace(part, cfg)


CLIENTS = {"claude": install_claude, "codex": install_codex, "cursor": install_cursor, "antigravity": install_antigravity}


def install(which, dry):
    bad = [w for w in which if w not in CLIENTS]
    if bad:
        print(f"[agents] unknown client {', '.join(bad)} (claude, codex, cursor or antigravity)", file=sys.stderr)
        return 2
    home, said = os.environ.get("HOME") or os.path.expanduser("~"), []
    for w in which or list(CLIENTS):
        CLIENTS[w](home, dry, said)
    print(("Would do (dry run):\n" if dry else "") + "\n".join(said))
    if not dry:
        print("\nRestart the clients so they read the new settings.")
    return 0


def main():
    parser = argparse.ArgumentParser(prog="formtools agents", description="the agents kit")
    parser.add_argument("action", choices=["install", "sync", "check"])
    parser.add_argument("clients", nargs="*", help="install only: claude, codex, cursor or antigravity (all by default)")
    parser.add_argument("--dry-run", action="store_true", help="install only: say what would change and change nothing")
    parser.add_argument("--user", action="store_true", help="install only: for this user account (the default)")
    parser.add_argument("--check", action="store_true", help="sync only: change nothing and fail when anything sync would write is out of date (the same as check)")
    args = parser.parse_args()
    if args.check and args.action != "sync":
        parser.error("--check goes with sync")
    if args.action == "install":
        return install(args.clients, args.dry_run)
    if args.clients:
        parser.error(f"{args.action} takes no client names")
    return sync() if args.action == "sync" and not args.check else check()


if __name__ == "__main__":
    sys.exit(main())
