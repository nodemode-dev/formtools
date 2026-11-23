import os
import time
from pathlib import Path

import pytest


def finish(client, started: dict, seconds: float = 20.0) -> dict:
    job = started
    deadline = time.monotonic() + seconds
    while job["state"] == "running":
        if time.monotonic() > deadline:
            raise AssertionError(f"job {job['id']} did not finish")
        time.sleep(0.02)
        job = client.get(f"/api/jobs/{job['id']}").json()
    return job


def run_job(client, url: str, body: dict) -> dict:
    reply = client.post(url, json=body)
    assert reply.status_code == 200, reply.text
    return finish(client, reply.json())


def disk(client, root: Path, **extra) -> dict:
    job = run_job(client, "/api/diskusage/scan", {"root": str(root), **extra})
    assert job["state"] == "done", job
    return job["result"]


def dupes(client, roots, **extra) -> dict:
    job = run_job(client, "/api/dupes/scan", {"roots": [str(r) for r in roots], **extra})
    assert job["state"] == "done", job
    return job["result"]


def put(path: Path, data: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def pattern(size: int, seed: int) -> bytes:
    return bytes((i * 31 + seed) % 251 for i in range(size))


def group_sets(result: dict) -> set:
    return {frozenset(Path(f["path"]).name for f in group["files"]) for group in result["groups"]}


def can_link(tmp_path: Path) -> bool:
    probe = tmp_path / "probe"
    probe.write_bytes(b"x")
    try:
        os.symlink(probe, tmp_path / "probe-link")
    except (OSError, NotImplementedError):
        return False
    return True


@pytest.fixture
def hosts_file(tmp_path, monkeypatch):
    path = tmp_path / "etc" / "hosts"
    path.parent.mkdir()
    monkeypatch.setenv("FORMTOOLS_HOSTS_PATH", str(path))
    return path


@pytest.fixture
def profile(tmp_path, monkeypatch):
    home = tmp_path / "profile-config"
    home.mkdir()
    monkeypatch.setenv("XDG_CONFIG_HOME", str(home))
    return home / "environment.d" / "60-formtools.conf"
