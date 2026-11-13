#!/usr/bin/env python3
import argparse
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCANNED = ["frontend/src", "frontend/public", "frontend/index.html", "frontend/overlay.html", "backend/app", "src-tauri/src"]
SUFFIXES = (".ts", ".js", ".mjs", ".py", ".rs", ".css", ".html", ".svg")
BANNED = re.compile(
    "\\bsparkles?\\s*:\\s*[`'\"]?\\s*<svg|\\bsparkles?\\s*:\\s*\\w+\\(|icon\\(\\s*['\"]sparkles?['\"]|"
    "\\b(?:v?[mM]agicWand|aiSparkle|stars)\\s*:\\s*[`'\"]?\\s*<svg|"
    "M12 1\\.5l1\\.5 4\\.5 4\\.5 1\\.5|M7\\.5 5\\.6L10 7 8\\.6 4\\.5|M17 3v3M15\\.5 4\\.5h3M20 8v2M19 9h2|"
    "[\\u2726\\u2727\\u2728\\u2734\\u2747]"
)
MESSAGE = "the three-star sparkle icon is banned app-wide (the owner's rule); Claude Code, agents and assistants use the agent, agentChat and terminal icons"


def tracked() -> list[str]:
    try:
        out = subprocess.check_output(["git", "ls-files", "--", *SCANNED], cwd=ROOT, text=True)
        return [line for line in out.splitlines() if line]
    except (OSError, subprocess.CalledProcessError):
        found = []
        for base in SCANNED:
            full = os.path.join(ROOT, base)
            if os.path.isfile(full):
                found.append(base)
                continue
            for folder, dirs, names in os.walk(full):
                dirs[:] = [d for d in dirs if d not in ("node_modules", "__pycache__", "dist")]
                found.extend(os.path.relpath(os.path.join(folder, n), ROOT).replace(os.sep, "/") for n in names)
        return found


def problems() -> list[str]:
    found = []
    for path in tracked():
        if not path.endswith(SUFFIXES) or "/i18n/" in path or path.endswith(".test.ts"):
            continue
        try:
            with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
                lines = handle.read().splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for number, line in enumerate(lines, start=1):
            if BANNED.search(line):
                found.append(f"{path}:{number}: {MESSAGE}")
    return found


def main() -> int:
    parser = argparse.ArgumentParser(prog="formtools sparkle", description="fail when the three-star sparkle icon returns")
    parser.add_argument("--check", action="store_true", help="exit 1 when any file has it (the default)")
    parser.parse_args()
    found = problems()
    for line in found:
        print(line)
    if found:
        return 1
    print("[sparkle] no three-star sparkle icon in the app")
    return 0


if __name__ == "__main__":
    sys.exit(main())
