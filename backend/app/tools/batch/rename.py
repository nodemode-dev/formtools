import json
import os
import re
import threading
import time
import uuid
from typing import Any

from app.core import config
from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.batch import naming, regexguard

MAX_PATHS = 5000
KEEP_UNDO = 20
RULE_TYPES = ("replace", "case", "insert", "remove", "counter", "date", "trim", "extension")
INVALID = naming.ILLEGAL
LOCK = threading.Lock()


def undo_file() -> str:
    return os.path.join(str(config.data_dir()), "rename-undo.json")


def split(name: str, is_dir: bool) -> tuple[str, str]:
    if is_dir:
        return name, ""
    stem, ext = os.path.splitext(name)
    return stem, ext.lstrip(".")


def join(stem: str, ext: str) -> str:
    return f"{stem}.{ext}" if ext else stem


def integer(rule: dict, key: str, default: int) -> int:
    try:
        return int(rule.get(key, default))
    except (TypeError, ValueError):
        raise ApiError(400, f"{key} in a {rule.get('type')} rule must be a number")


def validate_rules(rules: Any) -> list[dict]:
    if not isinstance(rules, list):
        raise ApiError(400, "rules must be a list")
    if len(rules) > 64:
        raise ApiError(400, "at most 64 rules are allowed")
    for rule in rules:
        if not isinstance(rule, dict) or rule.get("type") not in RULE_TYPES:
            raise ApiError(400, f"unknown rule type {rule.get('type') if isinstance(rule, dict) else rule}")
    return rules


def literal_replace(text: str, find: str, replacement: str, case: bool, everything: bool) -> str:
    if case:
        return text.replace(find, replacement, -1 if everything else 1)
    return re.sub(re.escape(find), lambda _: replacement, text, count=0 if everything else 1, flags=re.IGNORECASE)


def convert_template(replacement: str) -> str:
    return re.sub(r"\$(\d+)", r"\\g<\1>", replacement)


def apply_replace(rule: dict, states: list[dict]) -> None:
    find = str(rule.get("find", ""))
    if not find:
        return
    replacement = str(rule.get("replace", ""))
    scope = rule.get("scope", "name")
    if scope not in ("name", "ext", "both"):
        raise ApiError(400, "scope must be name, ext or both")
    case = bool(rule.get("case", False))
    everything = bool(rule.get("all", True))
    texts = [{"name": s["stem"], "ext": s["ext"], "both": join(s["stem"], s["ext"])}[scope] for s in states]
    if rule.get("regex"):
        done = regexguard.substitute(find, convert_template(replacement), texts, not case, 0 if everything else 1)
    else:
        done = [literal_replace(text, find, replacement, case, everything) for text in texts]
    for state, text in zip(states, done):
        if scope == "name":
            state["stem"] = text
        elif scope == "ext":
            state["ext"] = text.lstrip(".")
        else:
            state["stem"], state["ext"] = split(text, state["dir"])


def title_case(text: str) -> str:
    return re.sub(r"[A-Za-z0-9\u00c0-\uffff]+(?:'[A-Za-z]+)?", lambda match: match.group(0)[:1].upper() + match.group(0)[1:].lower(), text)


def sentence_case(text: str) -> str:
    lowered = text.lower()
    return lowered[:1].upper() + lowered[1:]


def apply_case(rule: dict, states: list[dict]) -> None:
    mode = rule.get("mode")
    functions = {"lower": str.lower, "upper": str.upper, "title": title_case, "sentence": sentence_case}
    if mode not in functions:
        raise ApiError(400, "case mode must be lower, upper, title or sentence")
    for state in states:
        state["stem"] = functions[mode](state["stem"])


def apply_insert(rule: dict, states: list[dict]) -> None:
    text = str(rule.get("text", ""))
    position = rule.get("position", "start")
    for state in states:
        stem = state["stem"]
        if position == "start":
            state["stem"] = text + stem
        elif position == "end":
            state["stem"] = stem + text
        else:
            try:
                index = int(position)
            except (TypeError, ValueError):
                raise ApiError(400, "insert position must be start, end or an index")
            index = max(0, min(len(stem), index if index >= 0 else len(stem) + index))
            state["stem"] = stem[:index] + text + stem[index:]


def apply_remove(rule: dict, states: list[dict]) -> None:
    start = max(0, integer(rule, "from", 0))
    count = max(0, integer(rule, "count", 1))
    for state in states:
        state["stem"] = state["stem"][:start] + state["stem"][start + count :]


def attach(stem: str, text: str, position: str, separator: str) -> str:
    return stem + separator + text if position == "end" else text + separator + stem


def apply_counter(rule: dict, states: list[dict]) -> None:
    start, step, pad = integer(rule, "start", 1), integer(rule, "step", 1), max(0, integer(rule, "pad", 0))
    position = "start" if rule.get("position") == "start" else "end"
    separator = str(rule.get("separator", "_"))
    for state in states:
        value = start + step * state["i"]
        text = str(abs(value)).zfill(pad)
        state["stem"] = attach(state["stem"], ("-" if value < 0 else "") + text, position, separator)


def apply_date(rule: dict, states: list[dict]) -> None:
    source = "mtime" if rule.get("source") == "mtime" else "exif"
    pattern = str(rule.get("format") or "%Y-%m-%d")
    position = "start" if rule.get("position") == "start" else "end"
    separator = str(rule.get("separator", "_"))
    for state in states:
        text = naming.format_date(naming.when(state["path"], source), pattern)
        state["stem"] = attach(state["stem"], text, position, separator)


def apply_trim(rule: dict, states: list[dict]) -> None:
    for state in states:
        text = re.sub(r"\s+", " ", state["stem"])
        text = re.sub(r"([_\-. ])\1+", r"\1", text)
        state["stem"] = text.strip()


def apply_extension(rule: dict, states: list[dict]) -> None:
    mode = rule.get("mode")
    if mode not in ("lower", "upper", "set"):
        raise ApiError(400, "extension mode must be lower, upper or set")
    value = str(rule.get("value", "")).strip().lstrip(".")
    for state in states:
        if state["dir"]:
            continue
        state["ext"] = state["ext"].lower() if mode == "lower" else state["ext"].upper() if mode == "upper" else value


APPLY = {
    "replace": apply_replace,
    "case": apply_case,
    "insert": apply_insert,
    "remove": apply_remove,
    "counter": apply_counter,
    "date": apply_date,
    "trim": apply_trim,
    "extension": apply_extension,
}


def bad_name(name: str) -> bool:
    if not name or name in (".", ".."):
        return True
    if INVALID.search(name) or name != name.rstrip(" ."):
        return True
    return len(name.encode("utf-8")) > 255


def paths_from(body: dict) -> list[str]:
    paths = body.get("paths")
    if not isinstance(paths, list) or not paths:
        raise ApiError(400, "paths must list at least one file or folder")
    if len(paths) > MAX_PATHS:
        raise ApiError(400, f"at most {MAX_PATHS} names can be renamed at once")
    resolved = []
    seen = set()
    for raw in paths:
        target = os.path.normpath(str(absolute(str(raw))))
        if not os.path.lexists(target):
            raise ApiError(404, f"{os.path.basename(target)} does not exist")
        key = naming.fs_key(target)
        if key not in seen:
            seen.add(key)
            resolved.append(target)
    return resolved


def plan(body: dict) -> dict:
    paths = paths_from(body)
    rules = validate_rules(body.get("rules", []))
    states = [
        {"path": path, "i": index, "dir": os.path.isdir(path), "stem": "", "ext": ""} for index, path in enumerate(paths)
    ]
    for state in states:
        state["stem"], state["ext"] = split(os.path.basename(state["path"]), state["dir"])
    for rule in rules:
        APPLY[rule["type"]](rule, states)
    proposals = []
    for state in states:
        name = join(state["stem"], state["ext"])
        proposals.append((state["path"], os.path.join(os.path.dirname(state["path"]), name), name))
    changed_sources = {naming.fs_key(src) for src, dst, _ in proposals if src != dst}
    counts: dict[str, int] = {}
    for src, dst, _ in proposals:
        counts[naming.fs_key(dst)] = counts.get(naming.fs_key(dst), 0) + 1
    items = []
    for src, dst, name in proposals:
        changed = src != dst
        conflict = "none"
        key = naming.fs_key(dst)
        if bad_name(name):
            conflict = "invalid"
        elif changed:
            if counts[key] > 1:
                conflict = "duplicate"
            elif os.path.lexists(dst) and key not in changed_sources and not same_file(src, dst):
                conflict = "exists"
        items.append({"src": src, "dst": dst, "changed": changed, "conflict": conflict})
    return {"items": items}


def same_file(first: str, second: str) -> bool:
    try:
        return os.path.samefile(first, second)
    except OSError:
        return False


def read_journal() -> dict:
    try:
        with open(undo_file(), encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict) and isinstance(data.get("entries"), list):
            return data
    except (OSError, ValueError):
        pass
    return {"next": 1, "entries": []}


def write_journal(data: dict) -> None:
    target = undo_file()
    temporary = f"{target}.{os.getpid()}.tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)
    os.replace(temporary, target)


def execute(pairs: list[tuple[str, str]]) -> None:
    sources = {naming.fs_key(src) for src, _ in pairs}
    tangled = [pair for pair in pairs if naming.fs_key(pair[1]) in sources]
    direct = [pair for pair in pairs if pair not in tangled]
    done: list[tuple[str, str]] = []
    staged: list[tuple[str, str]] = []

    def move(origin: str, target: str) -> None:
        os.rename(origin, target)
        done.append((origin, target))

    try:
        for src, dst in tangled:
            holder = os.path.join(os.path.dirname(src), f".formtools-rename-{uuid.uuid4().hex[:12]}.tmp")
            move(src, holder)
            staged.append((holder, dst))
        for src, dst in direct:
            move(src, dst)
        for holder, dst in staged:
            move(holder, dst)
    except OSError as exc:
        for origin, target in reversed(done):
            try:
                os.rename(target, origin)
            except OSError:
                pass
        raise ApiError(500, f"a rename failed ({exc.strerror or 'error'}); everything was put back")


def apply(body: dict) -> dict:
    result = plan(body)
    bad = [item for item in result["items"] if item["conflict"] != "none"]
    if bad:
        raise ApiError(409, f"{len(bad)} name{'s' if len(bad) != 1 else ''} conflict or cannot be used; nothing was renamed")
    pairs = [(item["src"], item["dst"]) for item in result["items"] if item["changed"]]
    if not pairs:
        return {"ok": True, "renamed": 0, "undo": None}
    with LOCK:
        execute(pairs)
        journal = read_journal()
        number = int(journal.get("next", 1))
        entry = {"id": f"u{number}", "time": time.time(), "pairs": [list(pair) for pair in pairs]}
        journal["next"] = number + 1
        journal["entries"] = (journal["entries"] + [entry])[-KEEP_UNDO:]
        write_journal(journal)
    return {"ok": True, "renamed": len(pairs), "undo": entry["id"]}


def undo(body: dict) -> dict:
    wanted = str(body.get("undo", ""))
    with LOCK:
        journal = read_journal()
        found = next((entry for entry in journal["entries"] if entry["id"] == wanted), None)
        if found is None:
            raise ApiError(404, "there is no undo with that id; only the last 20 renames are kept")
        pairs = [(dst, src) for src, dst in found["pairs"]]
        current = {naming.fs_key(origin) for origin, _ in pairs}
        for origin, target in pairs:
            if not os.path.lexists(origin):
                raise ApiError(409, f"{os.path.basename(origin)} is no longer there, so the rename cannot be undone")
            if os.path.lexists(target) and naming.fs_key(target) not in current and not same_file(origin, target):
                raise ApiError(409, f"{os.path.basename(target)} exists again, so the rename cannot be undone")
        execute(pairs)
        journal["entries"] = [entry for entry in journal["entries"] if entry["id"] != wanted]
        write_journal(journal)
    return {"ok": True, "restored": len(pairs)}
