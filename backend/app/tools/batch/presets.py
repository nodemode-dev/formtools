import json
import os
import re
import threading

from app.core import config
from app.core.errors import ApiError
from app.tools.batch import actions, service

NAME = re.compile(r"^[A-Za-z0-9 _-]{1,64}$")
LOCK = threading.Lock()


def folder() -> str:
    path = os.path.join(str(config.data_dir()), "presets")
    os.makedirs(path, exist_ok=True)
    return path


def file_for(name: str) -> str:
    if not NAME.match(name or "") or not name.strip():
        raise ApiError(400, "a preset name is 1 to 64 letters, digits, spaces, dashes or underscores")
    return os.path.join(folder(), f"{name}.json")


def listing() -> dict:
    found = []
    for entry in sorted(os.listdir(folder()), key=str.casefold):
        if not entry.endswith(".json"):
            continue
        name = entry[:-5]
        if not NAME.match(name):
            continue
        try:
            with open(os.path.join(folder(), entry), encoding="utf-8") as handle:
                data = json.load(handle)
            found.append({"name": name, "actions": data.get("actions", []), "output": data.get("output", {})})
        except (OSError, ValueError):
            continue
    return {"presets": found}


def save(name: str, body: dict) -> dict:
    target = file_for(name)
    acts = actions.normalise(body.get("actions") or [])
    output = service.normalise_output(body.get("output"))
    with LOCK:
        temporary = f"{target}.{os.getpid()}.tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump({"name": name, "actions": acts, "output": output}, handle, ensure_ascii=False, indent=2)
        os.replace(temporary, target)
    return {"ok": True, "name": name}


def remove(name: str) -> dict:
    target = file_for(name)
    with LOCK:
        if not os.path.isfile(target):
            raise ApiError(404, "there is no preset with that name")
        os.unlink(target)
    return {"ok": True}
