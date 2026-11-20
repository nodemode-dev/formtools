import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
PORT = 8240
ORIGIN = f"http://127.0.0.1:{PORT}"

_SANDBOX = Path(tempfile.mkdtemp(prefix="formtools-tests-"))
for name in [k for k in os.environ if k.startswith("FORMTOOLS_")]:
    del os.environ[name]
os.environ.update(FORMTOOLS_DATA_DIR=str(_SANDBOX / "data"), FORMTOOLS_PORT=str(PORT), HOME=str(_SANDBOX / "home"), XDG_DATA_HOME=str(_SANDBOX / "share"))
(_SANDBOX / "home").mkdir()
AGENT_NAMES = ("claude", "codex", "cursor-agent", "agent", "agy")
AGENT_CALLS = _SANDBOX / "agent-calls.log"
AGENT_SHELL = """#!/bin/sh
script=""
while [ $# -gt 0 ]; do if [ "$1" = "-c" ]; then shift; script="$1"; fi; shift; done
if [ -n "$script" ]; then exec /bin/sh -c "$script"; fi
exec /bin/sh
"""
PATH_WITHOUT_AGENTS = os.pathsep.join(d for d in os.environ.get("PATH", "").split(os.pathsep) if d and not any(os.path.exists(os.path.join(d, n)) for n in AGENT_NAMES))
if os.name != "nt":
    for _name in ("bin", "shell"):
        (_SANDBOX / _name).mkdir()
    for _name in AGENT_NAMES:
        (_SANDBOX / "bin" / _name).write_text(f'#!/bin/sh\necho "{_name} $*" >> "{AGENT_CALLS}"\nif [ "$1" = "--version" ]; then echo "0.0.0 (stand-in)"; exit 0; fi\nexit 1\n', encoding="utf-8")
        (_SANDBOX / "bin" / _name).chmod(0o755)
    (_SANDBOX / "shell" / "sh").write_text(AGENT_SHELL, encoding="utf-8")
    (_SANDBOX / "shell" / "sh").chmod(0o755)
    os.environ["SHELL"] = str(_SANDBOX / "shell" / "sh")
    os.environ["PATH"] = os.pathsep.join([str(_SANDBOX / "bin"), PATH_WITHOUT_AGENTS])
    for _name in ("NPM_CONFIG_PREFIX", "npm_config_prefix", "PNPM_HOME", "VOLTA_HOME", "BUN_INSTALL", "NVM_SYMLINK"):
        os.environ.pop(_name, None)
sys.path.insert(0, str(BACKEND))


@pytest.fixture(autouse=True)
def only_stand_in_agent_programs(monkeypatch):
    from app.services import agent_lookup

    monkeypatch.setattr(agent_lookup, "system_folders", lambda platform=None: [])


def pytest_terminal_summary(terminalreporter):
    try:
        calls = AGENT_CALLS.read_text(encoding="utf-8").splitlines()
    except OSError:
        calls = []
    terminalreporter.write_line(f"agent program stand-ins started {len(calls)} time(s): " + (", ".join(sorted(set(calls))) or "none"))


def window_headers() -> dict:
    from app.core import window_key

    return {window_key.HEADER: window_key.KEY}


@pytest.fixture(scope="session")
def app():
    from app.main import app as engine

    return engine


@pytest.fixture(scope="session")
def client(app):
    from fastapi.testclient import TestClient

    with TestClient(app, base_url=ORIGIN, headers=window_headers()) as c:
        yield c


@pytest.fixture(scope="session")
def bare(app):
    from fastapi.testclient import TestClient

    return TestClient(app, base_url=ORIGIN)
