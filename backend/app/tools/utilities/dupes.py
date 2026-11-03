from dataclasses import dataclass, field

import blake3
import numpy as np
import xxhash
from PIL import Image

from app.core.filetypes import IMAGE, ext_of
from app.core.jobs import Cancelled, Job
from app.tools.image import decode
from app.tools.utilities import walk

HEAD = 65536
CHUNK = 1 << 20
NOT_PICTURES = frozenset({"svg", "jxl"})
SWAPPED = (5, 6, 7, 8)


@dataclass(slots=True)
class Item:
    path: str
    size: int
    mtime: float
    ident: tuple | None = None
    width: int | None = None
    height: int | None = None
    aliases: list = field(default_factory=list)


def is_picture(path: str) -> bool:
    ext = ext_of(path)
    return ext in IMAGE and ext not in NOT_PICTURES


def collect(job: Job, params: dict, progress: walk.Progress, tally: walk.Tally, pictures: bool) -> list[Item]:
    items: list[Item] = []
    seen: set[str] = set()
    for root in params["roots"]:
        for path, info in walk.walk(root, params["recursive"], params["include_hidden"], tally):
            job.check()
            if path in seen:
                continue
            seen.add(path)
            progress.grow()
            progress.tick(path)
            if info.st_size < params["min_size"]:
                continue
            if pictures and not is_picture(path):
                continue
            items.append(Item(path, info.st_size, info.st_mtime, walk.identity(info)))
    progress.flush()
    return items


def collapse(items: list[Item]) -> list[Item]:
    first: dict[tuple, Item] = {}
    unique: list[Item] = []
    for item in items:
        if item.ident is not None:
            head = first.get(item.ident)
            if head is not None:
                head.aliases.append(item)
                continue
            first[item.ident] = item
        unique.append(item)
    return unique


def prehash(item: Item) -> str:
    digest = xxhash.xxh64()
    with open(item.path, "rb") as handle:
        digest.update(handle.read(HEAD))
        if item.size > HEAD:
            handle.seek(item.size - HEAD)
            digest.update(handle.read(HEAD))
    return digest.hexdigest()


def full_hash(job: Job, item: Item) -> str:
    digest = blake3.blake3()
    with open(item.path, "rb") as handle:
        while True:
            block = handle.read(CHUNK)
            if not block:
                break
            digest.update(block)
            job.check()
    return digest.hexdigest()


def entry(item: Item) -> dict:
    data = {"path": item.path, "size": item.size, "mtime": item.mtime}
    if item.width and item.height:
        data["width"] = item.width
        data["height"] = item.height
    return data


def listing(members: list[Item], order) -> list[dict]:
    files: list[dict] = []
    for member in sorted(members, key=order):
        files.append(entry(member))
        files.extend(entry(extra) for extra in sorted(member.aliases, key=lambda item: item.path))
    return files


def settle_error(tally: walk.Tally, item: Item, exc: BaseException) -> None:
    if isinstance(exc, Cancelled):
        raise exc
    tally(item.path, exc)


def run_exact(job: Job, params: dict) -> dict:
    tally = walk.Tally(job)
    progress = walk.Progress(job)
    items = collect(job, params, progress, tally, False)
    unique = collapse(items)
    by_size: dict[int, list[Item]] = {}
    for item in unique:
        by_size.setdefault(item.size, []).append(item)
    first_pass = [item for group in by_size.values() if len(group) > 1 for item in group]
    progress.grow(len(first_pass))
    heads: dict[tuple, list[Item]] = {}
    for item, digest, exc in walk.parallel(job, first_pass, prehash, workers=4):
        progress.tick(item.path)
        if exc is not None:
            settle_error(tally, item, exc)
            continue
        heads.setdefault((item.size, digest), []).append(item)
    second_pass = [item for group in heads.values() if len(group) > 1 for item in group]
    progress.grow(len(second_pass))
    finals: dict[tuple, list[Item]] = {}
    for item, digest, exc in walk.parallel(job, second_pass, lambda member: full_hash(job, member), workers=4):
        progress.tick(item.path)
        if exc is not None:
            settle_error(tally, item, exc)
            continue
        finals.setdefault((item.size, digest), []).append(item)
    progress.flush()
    groups = []
    for (size, digest), members in finals.items():
        if len(members) < 2:
            continue
        groups.append(
            {
                "key": digest,
                "size": size,
                "wasted": size * (len(members) - 1),
                "files": listing(members, lambda member: (member.mtime, member.path)),
            }
        )
    return finish(groups, len(items), tally, "exact")


def finish(groups: list[dict], scanned: int, tally: walk.Tally, mode: str) -> dict:
    groups.sort(key=lambda group: (-group["wasted"], group["key"]))
    return {
        "groups": groups,
        "scanned": scanned,
        "wasted": sum(group["wasted"] for group in groups),
        "errors": tally.errors,
        "mode": mode,
    }


def difference_hash(path: str) -> tuple[int, int | None, int | None]:
    image = decode.render(path, 256)
    try:
        small = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    finally:
        image.close()
    pixels = np.asarray(small, dtype=np.int16)
    bits = (pixels[:, 1:] > pixels[:, :-1]).ravel()
    value = int.from_bytes(np.packbits(bits).tobytes(), "big")
    width = height = None
    try:
        with Image.open(path) as header:
            width, height = header.size
            if header.getexif().get(0x0112, 1) in SWAPPED:
                width, height = height, width
    except Exception:
        pass
    return value, width, height


class BKTree:
    def __init__(self) -> None:
        self.root: tuple | None = None

    def add(self, value: int) -> None:
        if self.root is None:
            self.root = (value, {})
            return
        node = self.root
        while True:
            distance = (value ^ node[0]).bit_count()
            child = node[1].get(distance)
            if child is None:
                node[1][distance] = (value, {})
                return
            node = child

    def near(self, value: int, radius: int) -> list[int]:
        found: list[int] = []
        if self.root is None:
            return found
        stack = [self.root]
        while stack:
            node = stack.pop()
            distance = (value ^ node[0]).bit_count()
            if distance <= radius:
                found.append(node[0])
            for step, child in node[1].items():
                if distance - radius <= step <= distance + radius:
                    stack.append(child)
        return found


def components(job: Job, values: list[int], threshold: int) -> list[list[int]]:
    index = {value: position for position, value in enumerate(values)}
    parent = list(range(len(values)))

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    tree = BKTree()
    for position, value in enumerate(values):
        if position % 64 == 0:
            job.check()
        for other in tree.near(value, threshold):
            low, high = find(position), find(index[other])
            if low != high:
                parent[max(low, high)] = min(low, high)
        tree.add(value)
    grouped: dict[int, list[int]] = {}
    for position in range(len(values)):
        grouped.setdefault(find(position), []).append(values[position])
    return list(grouped.values())


def run_similar(job: Job, params: dict) -> dict:
    tally = walk.Tally(job)
    progress = walk.Progress(job)
    items = collect(job, params, progress, tally, True)
    unique = collapse(items)
    progress.grow(len(unique))
    by_hash: dict[int, list[Item]] = {}
    for item, result, exc in walk.parallel(job, unique, lambda member: difference_hash(member.path)):
        progress.tick(item.path)
        if exc is not None:
            settle_error(tally, item, exc)
            continue
        value, item.width, item.height = result
        by_hash.setdefault(value, []).append(item)
    progress.flush()
    groups = []
    for cluster in components(job, list(by_hash), int(params["threshold"])):
        members = [item for value in cluster for item in by_hash[value]]
        if len(members) < 2:
            continue
        largest = max(member.size for member in members)
        groups.append(
            {
                "key": format(min(cluster), "016x"),
                "size": largest,
                "wasted": sum(member.size for member in members) - largest,
                "files": listing(members, lambda member: (-((member.width or 0) * (member.height or 0)), -member.size, member.path)),
            }
        )
    return finish(groups, len(items), tally, "similar-images")
