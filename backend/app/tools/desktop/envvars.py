import os
import re
import sys
import tempfile
from pathlib import Path

from app.core import config
from app.core.errors import ApiError
from app.tools.desktop import elevate

POSIX_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PLAIN_VALUE = re.compile(r"^[A-Za-z0-9_@%+=:,./~-]+$")
LINE_NAME = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=")
MANAGED_FILE = "60-formtools.conf"
MANAGED_HEADER = "# Variables set from formtools. Other environment.d files are left alone.\n"
USER_KEY = "Environment"
SYSTEM_KEY = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
HWND_BROADCAST = 0xFFFF
WM_SETTINGCHANGE = 0x001A
SMTO_ABORTIFHUNG = 0x0002
MACOS_NOTE = "macOS has no per-user environment file that every app reads, so only the variables this engine was started with are listed"


def is_windows() -> bool:
    return sys.platform.startswith("win")


def valid_name(name: str) -> bool:
    if not name or len(name) > 255:
        return False
    if is_windows():
        return "=" not in name and not any(ord(ch) < 32 for ch in name) and name == name.strip()
    return bool(POSIX_NAME.match(name))


def check_value(value: str) -> None:
    if "\x00" in value or "\n" in value or "\r" in value:
        raise ApiError(400, "a value must stay on one line")
    if len(value) > 32767:
        raise ApiError(400, "that value is longer than 32767 characters")


def sorted_vars(items: dict[str, str]) -> list[dict]:
    return [{"name": name, "value": items[name]} for name in sorted(items, key=lambda key: (key.casefold(), key))]


def process_scope() -> dict:
    return {
        "id": "process",
        "editable": False,
        "where": "the environment this engine was started with",
        "vars": sorted_vars(dict(os.environ)),
    }


def windows_values(root, sub: str) -> list[dict]:
    import winreg

    found: dict[str, str] = {}
    try:
        with winreg.OpenKey(root, sub) as key:
            index = 0
            while True:
                try:
                    name, value, kind = winreg.EnumValue(key, index)
                except OSError:
                    break
                index += 1
                if kind in (winreg.REG_SZ, winreg.REG_EXPAND_SZ):
                    found[name] = str(value)
                elif kind == winreg.REG_DWORD:
                    found[name] = str(value)
    except OSError:
        pass
    return sorted_vars(found)


def config_home() -> Path:
    raw = os.environ.get("XDG_CONFIG_HOME", "")
    if raw and os.path.isabs(raw):
        return Path(raw)
    return Path.home() / ".config"


def managed_path() -> Path:
    return config_home() / "environment.d" / MANAGED_FILE


def unquote(text: str) -> str:
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] == '"':
        return re.sub(r"\\([\\\"])", r"\1", text[1:-1])
    if len(text) >= 2 and text[0] == text[-1] == "'":
        return text[1:-1]
    return text


def parse_conf(text: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped[0] in "#;":
            continue
        match = LINE_NAME.match(line)
        if match:
            found[match.group(1)] = unquote(line[match.end():])
    return found


def read_conf(path: Path) -> dict[str, str]:
    try:
        return parse_conf(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return {}


def other_conf_rows() -> list[dict]:
    rows: list[dict] = []
    folders = [config_home() / "environment.d", Path("/etc/environment.d")]
    for folder in folders:
        try:
            names = sorted(item for item in os.listdir(folder) if item.endswith(".conf"))
        except OSError:
            continue
        for name in names:
            if folder == folders[0] and name == MANAGED_FILE:
                continue
            for var, value in read_conf(folder / name).items():
                rows.append({"name": var, "value": value, "readonly": True, "source": str(folder / name)})
    return rows


def user_scope_posix() -> dict:
    managed = managed_path()
    rows = sorted_vars(read_conf(managed))
    return {
        "id": "user",
        "editable": True,
        "where": f"{managed} (systemd environment.d, read at the next login; other environment.d files are listed read-only)",
        "vars": rows + other_conf_rows(),
    }


def scopes(only: str | None = None) -> dict:
    result = [process_scope()]
    if is_windows():
        import winreg

        result.append(
            {"id": "user", "editable": True, "where": r"HKEY_CURRENT_USER\Environment", "vars": windows_values(winreg.HKEY_CURRENT_USER, USER_KEY)}
        )
        result.append(
            {
                "id": "system",
                "editable": True,
                "where": r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Environment (saving asks for administrator permission)",
                "vars": windows_values(winreg.HKEY_LOCAL_MACHINE, SYSTEM_KEY),
            }
        )
    elif sys.platform == "darwin":
        result[0]["where"] = MACOS_NOTE
    else:
        result.append(user_scope_posix())
    if only:
        result = [item for item in result if item["id"] == only]
        if not result:
            raise ApiError(400, "that scope does not exist on this system")
    return {"scopes": result}


def broadcast() -> None:
    import ctypes
    from ctypes import wintypes

    send = ctypes.windll.user32.SendMessageTimeoutW
    send.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, ctypes.c_wchar_p, wintypes.UINT, wintypes.UINT, ctypes.POINTER(ctypes.c_size_t)]
    send.restype = wintypes.LPARAM
    result = ctypes.c_size_t()
    send(HWND_BROADCAST, WM_SETTINGCHANGE, 0, "Environment", SMTO_ABORTIFHUNG, 5000, ctypes.byref(result))


def windows_kind(winreg, key, name: str, value: str) -> int:
    try:
        _, kind = winreg.QueryValueEx(key, name)
        if kind in (winreg.REG_SZ, winreg.REG_EXPAND_SZ):
            return winreg.REG_EXPAND_SZ if "%" in value else kind
    except OSError:
        pass
    return winreg.REG_EXPAND_SZ if "%" in value else winreg.REG_SZ


def windows_write(root, sub: str, name: str, value: str | None) -> None:
    import winreg

    with winreg.OpenKey(root, sub, 0, winreg.KEY_SET_VALUE | winreg.KEY_QUERY_VALUE) as key:
        if value is None:
            try:
                winreg.DeleteValue(key, name)
            except FileNotFoundError:
                pass
        else:
            winreg.SetValueEx(key, name, 0, windows_kind(winreg, key, name, value), value)


def windows_system_elevated(name: str, value: str | None) -> None:
    import winreg

    literal = elevate.powershell_literal
    path = "HKLM:\\" + SYSTEM_KEY
    if value is None:
        body = f"Remove-ItemProperty -LiteralPath {literal(path)} -Name {literal(name)} -ErrorAction SilentlyContinue"
    else:
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, SYSTEM_KEY) as key:
                kind = windows_kind(winreg, key, name, value)
        except OSError:
            kind = winreg.REG_EXPAND_SZ if "%" in value else winreg.REG_SZ
        label = "ExpandString" if kind == winreg.REG_EXPAND_SZ else "String"
        body = f"Set-ItemProperty -LiteralPath {literal(path)} -Name {literal(name)} -Value {literal(value)} -Type {label}"
    elevate.windows_script(body)


def quote_conf(value: str) -> str:
    if PLAIN_VALUE.match(value):
        return value
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_managed(name: str, value: str | None) -> None:
    path = managed_path()
    try:
        original = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        original = MANAGED_HEADER
    except (OSError, UnicodeDecodeError) as exc:
        raise ApiError(500, f"{path} could not be read ({getattr(exc, 'strerror', None) or type(exc).__name__})")
    rows: list[str] = []
    placed = False
    for line in original.splitlines(keepends=True):
        match = LINE_NAME.match(line)
        if match and match.group(1) == name:
            if value is not None and not placed:
                rows.append(f"{name}={quote_conf(value)}\n")
                placed = True
            continue
        rows.append(line)
    if value is not None and not placed:
        if rows and not rows[-1].endswith("\n"):
            rows[-1] += "\n"
        rows.append(f"{name}={quote_conf(value)}\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp = tempfile.mkstemp(dir=str(path.parent), prefix=".60-formtools-")
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="") as stream:
            stream.write("".join(rows))
        os.chmod(temp, 0o644)
        os.replace(temp, path)
    except OSError as exc:
        try:
            os.unlink(temp)
        except OSError:
            pass
        raise ApiError(500, f"{path} could not be written ({exc.strerror or type(exc).__name__})")


def set_var(scope: str, name: str, value: str | None) -> dict:
    if scope == "process":
        raise ApiError(400, "the process scope is read only")
    if scope not in ("user", "system"):
        raise ApiError(400, "scope must be user or system")
    if not valid_name(name):
        raise ApiError(400, f"{name or 'an empty name'} is not a valid variable name")
    if value is not None:
        check_value(value)
    elevated = False
    if is_windows():
        import winreg

        if scope == "user":
            windows_write(winreg.HKEY_CURRENT_USER, USER_KEY, name, value)
        else:
            try:
                windows_write(winreg.HKEY_LOCAL_MACHINE, SYSTEM_KEY, name, value)
            except PermissionError:
                elevated = True
                windows_system_elevated(name, value)
        broadcast()
    elif sys.platform == "darwin" or scope == "system":
        raise ApiError(400, "that scope cannot be edited on this system")
    else:
        write_managed(name, value)
    return {"ok": True, "scope": scope, "name": name, "elevated": elevated, "applies": "new programs" if is_windows() else "the next login"}
