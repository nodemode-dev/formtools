import gc
import heapq
import os

from app.core.jobs import Job
from app.tools.utilities import categories, walk

MAX_DEPTH = 8
KEEP = 60
TOP_EXT = 40
TOP_FILES = 50
BLOCK = 4096
HAS_BLOCKS = hasattr(os.stat_result, "st_blocks")
EXEC_BITS = 0o111


def add_types(into: dict, source: dict) -> None:
    for key, value in source.items():
        into[key] = into.get(key, 0) + value


class Frame:
    __slots__ = (
        "path",
        "name",
        "depth",
        "forced",
        "pending",
        "files",
        "file_items",
        "dir_nodes",
        "size",
        "alloc",
        "types",
        "file_count",
        "dir_count",
    )

    def __init__(self, path: str, name: str, depth: int, forced: str | None) -> None:
        self.path = path
        self.name = name
        self.depth = depth
        self.forced = forced
        self.pending: list[tuple[str, str]] = []
        self.files = 0
        self.file_items: list[tuple] = []
        self.dir_nodes: list[dict] = []
        self.size = 0
        self.alloc = 0
        self.types: dict[str, int] = {}
        self.file_count = 0
        self.dir_count = 0


class Scan:
    def __init__(self, job: Job, include_hidden: bool) -> None:
        self.job = job
        self.include_hidden = include_hidden
        self.tally = walk.Tally(job)
        self.links: set[tuple[int, int]] = set()
        self.found = 1
        self.done = 0
        self.since = 0
        self.by_ext: dict[tuple[str, str], list[int]] = {}
        self.top: list[tuple] = []
        self.floor = 0
        self.serial = 0
        self.newest = 0.0
        self.oldest = float("inf")
        self.link_extra = 0

    def report(self, path: str) -> None:
        self.since += 1
        if self.since >= 8:
            self.since = 0
            self.job.step(done=self.done, current=path, total=max(self.found, self.done))

    def note_large(self, size: int, path: str, alloc: int, mtime: float, ext: str, category: str) -> None:
        self.serial += 1
        item = (size, self.serial, path, alloc, mtime, ext, category)
        if len(self.top) < TOP_FILES:
            heapq.heappush(self.top, item)
        else:
            heapq.heapreplace(self.top, item)
        if len(self.top) >= TOP_FILES:
            self.floor = self.top[0][0]
        else:
            self.floor = 0

    def open(self, path: str, name: str, depth: int, forced: str | None) -> Frame:
        frame = Frame(path, name, depth, forced)
        self.done += 1
        try:
            with os.scandir(path) as scanner:
                entries = list(scanner)
        except OSError as exc:
            self.tally(path, exc)
            return frame
        keep_files = depth < MAX_DEPTH
        by_ext = self.by_ext
        types = frame.types
        links = self.links
        ext_table = categories.EXT
        forced = frame.forced
        newest = self.newest
        oldest = self.oldest
        floor = self.floor
        total = spent = count = 0
        for entry in entries:
            try:
                if entry.is_symlink():
                    continue
                entry_name = entry.name
                if not self.include_hidden and entry_name.startswith("."):
                    continue
                if entry.is_dir(follow_symlinks=False):
                    frame.pending.append((entry_name, entry.path))
                    self.found += 1
                    continue
                if not entry.is_file(follow_symlinks=False):
                    continue
                info = entry.stat(follow_symlinks=False)
            except OSError as exc:
                self.tally(entry.path, exc)
                continue
            if not self.include_hidden and walk.hidden_by_attribute(info):
                continue
            size = info.st_size
            alloc = info.st_blocks << 9 if HAS_BLOCKS else -(-size // BLOCK) * BLOCK
            if info.st_nlink > 1 and info.st_ino:
                ident = (info.st_dev, info.st_ino)
                if ident in links:
                    size = 0
                    alloc = 0
                    self.link_extra += 1
                else:
                    links.add(ident)
            dot = entry_name.rfind(".")
            if dot > 0:
                ext = entry_name[dot + 1 :].lower()
                if len(ext) > 12 or ext.isdigit():
                    ext = categories.fix_ext(entry_name, ext)
            else:
                ext = ""
            category = forced or ext_table.get(ext)
            if category is None:
                category = categories.of_file(entry_name, ext, bool(info.st_mode & EXEC_BITS), None)
            key = (ext, category)
            slot = by_ext.get(key)
            if slot is None:
                by_ext[key] = [size, alloc, 1]
            else:
                slot[0] += size
                slot[1] += alloc
                slot[2] += 1
            mtime = info.st_mtime
            if mtime > newest:
                newest = mtime
            if mtime < oldest:
                oldest = mtime
            if size > floor and size > 0:
                self.note_large(size, entry.path, alloc, mtime, ext, category)
                floor = self.floor
            types[category] = types.get(category, 0) + size
            total += size
            spent += alloc
            count += 1
            if keep_files:
                frame.file_items.append((size, entry_name, entry.path, alloc, ext, category))
        frame.size += total
        frame.alloc += spent
        frame.files += count
        self.found += count
        self.done += count
        self.newest = newest
        self.oldest = oldest
        self.report(path)
        return frame


def file_node(item: tuple) -> dict:
    return {
        "name": item[1],
        "path": item[2],
        "size": item[0],
        "allocated": item[3],
        "files": 1,
        "dirs": 0,
        "dir": False,
        "ext": item[4],
        "category": item[5],
        "types": {item[5]: item[0]},
    }


def finish(frame: Frame) -> dict:
    files = frame.files + sum(node["files"] for node in frame.dir_nodes)
    dirs = frame.dir_count + sum(1 + node["dirs"] for node in frame.dir_nodes)
    size = frame.size + sum(node["size"] for node in frame.dir_nodes)
    alloc = frame.alloc + sum(node["allocated"] for node in frame.dir_nodes)
    types = frame.types
    for child in frame.dir_nodes:
        add_types(types, child["types"])
    node = {
        "name": frame.name,
        "path": frame.path,
        "size": size,
        "allocated": alloc,
        "files": files,
        "dirs": dirs,
        "dir": True,
        "types": types,
        "children": [],
    }
    if frame.depth >= MAX_DEPTH:
        return node
    candidates = [(item[0], False, item) for item in frame.file_items] + [(child["size"], True, child) for child in frame.dir_nodes]
    kept = heapq.nlargest(KEEP, candidates, key=lambda candidate: candidate[0])
    kept_ids = {id(candidate[2]) for candidate in kept}
    children = [candidate[2] if candidate[1] else file_node(candidate[2]) for candidate in kept]
    folded = [candidate for candidate in candidates if id(candidate[2]) not in kept_ids]
    if folded:
        other_files = other_dirs = other_size = other_alloc = 0
        other_types: dict[str, int] = {}
        for candidate in folded:
            other_size += candidate[0]
            if candidate[1]:
                other_files += candidate[2]["files"]
                other_dirs += 1 + candidate[2]["dirs"]
                other_alloc += candidate[2]["allocated"]
                add_types(other_types, candidate[2]["types"])
            else:
                other_files += 1
                other_alloc += candidate[2][3]
                other_types[candidate[2][5]] = other_types.get(candidate[2][5], 0) + candidate[0]
        children.append(
            {
                "name": f"Other ({len(folded)} items)",
                "path": frame.path,
                "size": other_size,
                "allocated": other_alloc,
                "files": other_files,
                "dirs": other_dirs,
                "dir": False,
                "other": True,
                "types": other_types,
            }
        )
    node["children"] = children
    return node


def build_stats(scan: Scan, tree: dict) -> dict:
    by_type: dict[str, list[int]] = {}
    for (ext, category), slot in scan.by_ext.items():
        row = by_type.setdefault(category, [0, 0, 0])
        row[0] += slot[0]
        row[1] += slot[1]
        row[2] += slot[2]
    order = {name: index for index, name in enumerate(categories.ORDER)}
    types = [{"category": name, "bytes": row[0], "allocated": row[1], "files": row[2]} for name, row in by_type.items()]
    types.sort(key=lambda row: (-row["bytes"], order.get(row["category"], 99)))
    exts = heapq.nlargest(TOP_EXT, scan.by_ext.items(), key=lambda pair: pair[1][0])
    largest = sorted(scan.top, key=lambda item: -item[0])
    files = tree["files"]
    return {
        "by_type": types,
        "by_ext": [{"ext": key[0], "category": key[1], "bytes": slot[0], "allocated": slot[1], "files": slot[2]} for key, slot in exts],
        "largest": [
            {"path": item[2], "size": item[0], "allocated": item[3], "mtime": item[4], "ext": item[5], "category": item[6]}
            for item in largest
        ],
        "files": files,
        "folders": tree["dirs"],
        "errors": scan.tally.errors,
        "apparent": tree["size"],
        "allocated": tree["allocated"],
        "average_file": (tree["size"] // files) if files else 0,
        "newest": scan.newest if files else None,
        "oldest": scan.oldest if files else None,
        "hardlinks_counted_once": scan.link_extra,
        "allocation": "blocks" if HAS_BLOCKS else "rounded-4096",
    }


def run(job: Job, root: str, include_hidden: bool) -> dict:
    paused = gc.isenabled()
    if paused:
        gc.disable()
    try:
        return walk_tree(job, root, include_hidden)
    finally:
        if paused:
            gc.enable()


def walk_tree(job: Job, root: str, include_hidden: bool) -> dict:
    scan = Scan(job, include_hidden)
    root_name = os.path.basename(root.rstrip("\\/")) or root
    stack = [scan.open(root, root_name, 0, categories.folder_category(root_name, None))]
    tree: dict = {}
    while stack:
        job.check()
        top = stack[-1]
        if top.pending:
            name, path = top.pending.pop()
            stack.append(scan.open(path, name, top.depth + 1, categories.folder_category(name, top.forced)))
            continue
        stack.pop()
        node = finish(top)
        if not stack:
            tree = node
            break
        parent = stack[-1]
        if parent.depth < MAX_DEPTH:
            parent.dir_nodes.append(node)
        else:
            parent.size += node["size"]
            parent.alloc += node["allocated"]
            parent.files += node["files"]
            parent.dir_count += 1 + node["dirs"]
            add_types(parent.types, node["types"])
    job.step(done=scan.done, total=max(scan.found, scan.done))
    tree["errors"] = scan.tally.errors
    tree["stats"] = build_stats(scan, tree)
    return tree
