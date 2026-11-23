import os
import time
from collections import Counter

from PIL import Image


def make_files(folder, names):
    paths = []
    for name in names:
        target = folder / name
        target.write_text(f"content of {name}", encoding="utf-8")
        paths.append(str(target))
    return paths


def contents(folder):
    found = Counter()
    for root, _, files in os.walk(folder):
        for name in files:
            with open(os.path.join(root, name), "rb") as handle:
                found[handle.read()] += 1
    return found


def names(folder):
    return sorted(os.listdir(folder))


def new_names(reply):
    return [os.path.basename(item["dst"]) for item in reply["items"]]


def rename_plan(client, paths, rules):
    return client.post("/api/rename/plan", json={"paths": paths, "rules": rules})


def rename_apply(client, paths, rules):
    return client.post("/api/rename/apply", json={"paths": paths, "rules": rules})


def make_picture(path, size=(8, 4), left=(255, 0, 0), right=(0, 0, 255)):
    image = Image.new("RGB", size, left)
    half = size[0] // 2
    for x in range(half, size[0]):
        for y in range(size[1]):
            image.putpixel((x, y), right)
    image.save(path)
    return str(path)


def wait_job(client, job, limit=45.0):
    end = time.monotonic() + limit
    while time.monotonic() < end:
        state = client.get(f"/api/jobs/{job['id']}").json()
        if state["state"] != "running":
            return state
        time.sleep(0.1)
    raise AssertionError("the batch job did not finish in time")
