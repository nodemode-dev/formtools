import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from app.core.errors import ApiError

TIMEOUT = 180
REFUSED = "administrator permission was not given, so nothing was changed"


def refuse(reason: str | None = None) -> ApiError:
    return ApiError(403, f"{REFUSED} ({reason})" if reason else REFUSED)


def run(command: list[str]) -> int:
    try:
        done = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        raise refuse("the request timed out")
    except OSError as exc:
        raise refuse(exc.strerror or type(exc).__name__)
    return done.returncode


def applescript_literal(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def powershell_literal(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def windows_script(body: str) -> None:
    folder = Path(tempfile.mkdtemp(prefix="formtools-elevate-"))
    try:
        inner = folder / "inner.ps1"
        outer = folder / "outer.ps1"
        inner.write_text("$ErrorActionPreference = 'Stop'\n" + body + "\n", encoding="utf-8-sig")
        outer.write_text(
            "$ErrorActionPreference = 'Stop'\n"
            "try {\n"
            "  $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -WindowStyle Hidden "
            f"-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',{powershell_literal(chr(34) + str(inner) + chr(34))}\n"
            "  exit $p.ExitCode\n"
            "} catch { exit 1 }\n",
            encoding="utf-8-sig",
        )
        code = run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(outer)])
        if code != 0:
            raise refuse()
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def copy_command(source: Path, target: Path) -> list[str]:
    if target.exists():
        return ["/bin/cp", "-f", str(source), str(target)]
    return ["/usr/bin/install", "-m", "644", str(source), str(target)]


def write_file(target: Path, data: bytes) -> None:
    folder = Path(tempfile.mkdtemp(prefix="formtools-elevate-"))
    try:
        staged = folder / "staged"
        staged.write_bytes(data)
        os.chmod(staged, 0o644)
        if sys.platform.startswith("win"):
            windows_script(f"Copy-Item -LiteralPath {powershell_literal(str(staged))} -Destination {powershell_literal(str(target))} -Force")
        elif sys.platform == "darwin":
            words = [applescript_literal(word) for word in copy_command(staged, target)]
            script = "do shell script " + " & space & ".join(f"quoted form of {word}" for word in words) + " with administrator privileges"
            if run(["osascript", "-e", script]) != 0:
                raise refuse()
        else:
            if shutil.which("pkexec") is None:
                raise refuse("pkexec is not installed; edit the file as an administrator instead")
            if run(["pkexec", *copy_command(staged, target)]) != 0:
                raise refuse()
        if target.read_bytes() != data:
            raise ApiError(500, "the administrator step ran but the file does not hold the new content")
    finally:
        shutil.rmtree(folder, ignore_errors=True)
