import json
import re
import subprocess
import sys

from app.core import config
from app.core.errors import ApiError

try:
    from re import _constants as constants
    from re import _parser as parser
except ImportError:
    import sre_constants as constants
    import sre_parse as parser

TIME_LIMIT = 1.0
MAX_NAME = 1024
MAX_PATTERN = 256

CHILD = """
import json, re, sys
data = json.load(sys.stdin)
try:
    compiled = re.compile(data["pattern"], re.IGNORECASE if data["ignore"] else 0)
    done = [compiled.sub(data["repl"], name, count=data["count"]) for name in data["names"]]
    json.dump({"ok": done}, sys.stdout)
except re.error as exc:
    json.dump({"error": "the regular expression or its replacement is not valid: " + str(exc)}, sys.stdout)
except Exception as exc:
    json.dump({"error": "the regular expression failed: " + str(exc)}, sys.stdout)
"""

REPEATS = tuple(
    getattr(constants, name) for name in ("MAX_REPEAT", "MIN_REPEAT", "POSSESSIVE_REPEAT") if hasattr(constants, name)
)


def risky(items, inside: bool = False, counter: list | None = None) -> bool:
    counter = counter if counter is not None else [0]
    for op, value in items:
        if op in REPEATS:
            high, body = value[1], value[2]
            open_ended = high > 1
            if open_ended:
                counter[0] += 1
                if inside or counter[0] > 3:
                    return True
            if risky(body, inside or open_ended, counter):
                return True
        elif op == constants.BRANCH:
            if inside:
                return True
            for branch in value[1]:
                if risky(branch, inside, counter):
                    return True
        elif op == constants.SUBPATTERN:
            if risky(value[-1], inside, counter):
                return True
        elif op in (constants.ASSERT, constants.ASSERT_NOT):
            if risky(value[1], inside, counter):
                return True
    return False


def inline_checked(pattern: str) -> None:
    try:
        tree = parser.parse(pattern)
    except re.error as exc:
        raise ApiError(400, f"the regular expression is not valid: {exc}")
    if risky(tree):
        raise ApiError(400, "that regular expression is too complex to run safely here; simplify the repeats")


def substitute(pattern: str, replacement: str, names: list[str], ignore_case: bool, count: int) -> list[str]:
    if len(pattern) > MAX_PATTERN:
        raise ApiError(400, "the regular expression is too long")
    if any(len(name) > MAX_NAME for name in names):
        raise ApiError(400, "a name is longer than 1024 characters")
    if config.frozen() or not sys.executable:
        inline_checked(pattern)
        try:
            compiled = re.compile(pattern, re.IGNORECASE if ignore_case else 0)
            return [compiled.sub(replacement, name, count=count) for name in names]
        except re.error as exc:
            raise ApiError(400, f"the regular expression or its replacement is not valid: {exc}")
    payload = json.dumps({"pattern": pattern, "repl": replacement, "names": names, "ignore": ignore_case, "count": count})
    try:
        done = subprocess.run(
            [sys.executable, "-I", "-S", "-c", CHILD],
            input=payload,
            capture_output=True,
            text=True,
            timeout=TIME_LIMIT,
        )
    except subprocess.TimeoutExpired:
        raise ApiError(400, "that regular expression took longer than 1 second and was stopped")
    except OSError:
        inline_checked(pattern)
        try:
            compiled = re.compile(pattern, re.IGNORECASE if ignore_case else 0)
            return [compiled.sub(replacement, name, count=count) for name in names]
        except re.error as exc:
            raise ApiError(400, f"the regular expression or its replacement is not valid: {exc}")
    try:
        answer = json.loads(done.stdout)
    except ValueError:
        raise ApiError(400, "the regular expression could not be evaluated")
    if "error" in answer:
        raise ApiError(400, answer["error"])
    return answer["ok"]
