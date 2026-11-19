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
sys.path.insert(0, str(BACKEND))


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
