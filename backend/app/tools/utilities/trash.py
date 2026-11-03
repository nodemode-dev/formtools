import os
from pathlib import Path

from app.core.errors import ApiError
from app.routers.fs import absolute

LIMIT = 5000


def protected(path: Path) -> bool:
    if path.parent == path:
        return True
    try:
        return os.path.samefile(path, Path.home())
    except OSError:
        return False


def move_to_trash(paths: list[str]) -> dict:
    if len(paths) > LIMIT:
        raise ApiError(400, f"at most {LIMIT} paths can be moved to the trash at once")
    try:
        from send2trash import send2trash
    except Exception:
        raise ApiError(501, "this build has no way to reach the system trash")
    trashed = 0
    errors: list[dict] = []
    for raw in paths:
        try:
            path = absolute(raw)
            if not os.path.lexists(path):
                raise ApiError(404, "that path does not exist")
            if protected(path):
                raise ApiError(400, "formtools will not trash a drive root or your home folder")
            send2trash(str(path))
            trashed += 1
        except ApiError as exc:
            errors.append({"path": raw, "error": exc.message})
        except Exception as exc:
            errors.append({"path": raw, "error": f"the trash refused it ({exc.strerror if isinstance(exc, OSError) and exc.strerror else type(exc).__name__})"})
    return {"trashed": trashed, "errors": errors}
