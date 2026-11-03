import os

from app.core.errors import ApiError
from app.routers.fs import absolute


def folded(path: str) -> str:
    return os.path.normcase(os.path.realpath(path))


def inside(candidate: str, target: str, is_folder: bool) -> bool:
    if candidate == target:
        return True
    return is_folder and candidate.startswith(target.rstrip(os.sep) + os.sep)


def holders(raw: str) -> dict:
    path = absolute(raw)
    if not os.path.lexists(path):
        raise ApiError(404, "that path does not exist")
    try:
        import psutil
    except Exception:
        return {"supported": False, "holders": []}
    target = folded(str(path))
    is_folder = os.path.isdir(target)
    found: list[dict] = []
    examined = 0
    for proc in psutil.process_iter(["pid", "name", "username"]):
        try:
            files = [item.path for item in proc.open_files()]
            if is_folder:
                try:
                    files.append(proc.cwd())
                except (psutil.Error, OSError):
                    pass
        except (psutil.AccessDenied, psutil.ZombieProcess, psutil.NoSuchProcess, NotImplementedError, OSError):
            continue
        except Exception:
            continue
        examined += 1
        if any(inside(folded(name), target, is_folder) for name in files if name):
            info = proc.info
            found.append({"pid": info["pid"], "name": info.get("name") or "", "user": info.get("username") or ""})
    found.sort(key=lambda item: item["pid"])
    return {"supported": examined > 0, "holders": found, "examined": examined}
