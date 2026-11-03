import heapq
import os

from app.core.jobs import Job
from app.tools.utilities import walk

MAX_DEPTH = 8
KEEP = 60


class Frame:
    __slots__ = ("path", "name", "depth", "pending", "files", "file_items", "dir_nodes", "size", "file_count", "dir_count")

    def __init__(self, path: str, name: str, depth: int) -> None:
        self.path = path
        self.name = name
        self.depth = depth
        self.pending: list[tuple[str, str]] = []
        self.files = 0
        self.file_items: list[tuple[int, str, str]] = []
        self.dir_nodes: list[dict] = []
        self.size = 0
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

    def report(self, path: str) -> None:
        self.since += 1
        if self.since >= 8:
            self.since = 0
            self.job.step(done=self.done, current=path, total=max(self.found, self.done))

    def open(self, path: str, name: str, depth: int) -> Frame:
        frame = Frame(path, name, depth)
        self.done += 1
        try:
            with os.scandir(path) as scanner:
                entries = list(scanner)
        except OSError as exc:
            self.tally(path, exc)
            return frame
        keep_files = depth < MAX_DEPTH
        for entry in entries:
            try:
                if entry.is_symlink():
                    continue
                if not self.include_hidden and entry.name.startswith("."):
                    continue
                if entry.is_dir(follow_symlinks=False):
                    frame.pending.append((entry.name, entry.path))
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
            ident = walk.identity(info)
            if ident is not None:
                if ident in self.links:
                    size = 0
                else:
                    self.links.add(ident)
            frame.size += size
            frame.files += 1
            self.found += 1
            self.done += 1
            if keep_files:
                frame.file_items.append((size, entry.name, entry.path))
        self.report(path)
        return frame


def file_node(item: tuple[int, str, str]) -> dict:
    return {"name": item[1], "path": item[2], "size": item[0], "files": 1, "dirs": 0, "dir": False}


def finish(frame: Frame) -> dict:
    files = frame.files + sum(node["files"] for node in frame.dir_nodes)
    dirs = frame.dir_count + sum(1 + node["dirs"] for node in frame.dir_nodes)
    size = frame.size + sum(node["size"] for node in frame.dir_nodes)
    node = {"name": frame.name, "path": frame.path, "size": size, "files": files, "dirs": dirs, "dir": True, "children": []}
    if frame.depth >= MAX_DEPTH:
        return node
    candidates = [(item[0], False, item) for item in frame.file_items] + [(child["size"], True, child) for child in frame.dir_nodes]
    kept = heapq.nlargest(KEEP, candidates, key=lambda candidate: candidate[0])
    kept_ids = {id(candidate[2]) for candidate in kept}
    children = [candidate[2] if candidate[1] else file_node(candidate[2]) for candidate in kept]
    folded = [candidate for candidate in candidates if id(candidate[2]) not in kept_ids]
    if folded:
        other_files = other_dirs = other_size = 0
        for candidate in folded:
            other_size += candidate[0]
            if candidate[1]:
                other_files += candidate[2]["files"]
                other_dirs += 1 + candidate[2]["dirs"]
            else:
                other_files += 1
        children.append(
            {
                "name": f"Other ({len(folded)} items)",
                "path": frame.path,
                "size": other_size,
                "files": other_files,
                "dirs": other_dirs,
                "dir": False,
                "other": True,
            }
        )
    node["children"] = children
    return node


def run(job: Job, root: str, include_hidden: bool) -> dict:
    scan = Scan(job, include_hidden)
    stack = [scan.open(root, os.path.basename(root.rstrip("\\/")) or root, 0)]
    tree: dict = {}
    while stack:
        job.check()
        top = stack[-1]
        if top.pending:
            name, path = top.pending.pop()
            stack.append(scan.open(path, name, top.depth + 1))
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
            parent.files += node["files"]
            parent.dir_count += 1 + node["dirs"]
    job.step(done=scan.done, total=max(scan.found, scan.done))
    tree["errors"] = scan.tally.errors
    return tree
