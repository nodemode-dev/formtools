import io
import tarfile
import time
import zipfile
from pathlib import Path


def finish(client, started: dict, seconds: float = 20.0) -> dict:
    job = started
    deadline = time.monotonic() + seconds
    while job["state"] == "running":
        if time.monotonic() > deadline:
            raise AssertionError(f"job {job['id']} did not finish")
        time.sleep(0.02)
        job = client.get(f"/api/jobs/{job['id']}").json()
    return job


def post_job(client, url: str, body: dict) -> dict:
    reply = client.post(url, json=body)
    assert reply.status_code == 200, reply.text
    return finish(client, reply.json())


def tree(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file() and not p.is_symlink()}


def make_source(base: Path) -> Path:
    src = base / "src"
    (src / "sub" / "deep").mkdir(parents=True)
    (src / "a.txt").write_bytes(b"alpha\nline two\n")
    (src / "sub" / "b.bin").write_bytes(bytes(range(256)) * 9000)
    (src / "sub" / "deep" / "empty.dat").write_bytes(b"")
    (src / "sub" / "deep" / "unicode name \u00e9.txt").write_bytes("caf\u00e9".encode("utf-8"))
    return src


def tar_with(path: Path, members: list[tuple[tarfile.TarInfo, bytes | None]], mode: str = "w:gz") -> Path:
    with tarfile.open(path, mode) as tf:
        for info, payload in members:
            if payload is None:
                tf.addfile(info)
            else:
                info.size = len(payload)
                tf.addfile(info, io.BytesIO(payload))
    return path


def file_info(name: str, mode: int = 0o644, mtime: int = 1_000_000_000) -> tarfile.TarInfo:
    info = tarfile.TarInfo(name)
    info.mode = mode
    info.mtime = mtime
    return info


def link_info(name: str, target: str, kind: bytes = tarfile.SYMTYPE) -> tarfile.TarInfo:
    info = tarfile.TarInfo(name)
    info.type = kind
    info.linkname = target
    return info


def zip_with(path: Path, members: dict[str, bytes], compression: int = zipfile.ZIP_DEFLATED) -> Path:
    with zipfile.ZipFile(path, "w", compression=compression) as zf:
        for name, payload in members.items():
            zf.writestr(name, payload)
    return path
