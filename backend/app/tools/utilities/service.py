from app.core import jobs
from app.tools.utilities import diskusage, dupes, tidy, walk


def start_dupes(roots: list[str], recursive: bool, min_size: int, mode: str, threshold: int, include_hidden: bool) -> dict:
    params = {
        "roots": walk.folder_roots(roots, recursive),
        "recursive": recursive,
        "min_size": max(0, int(min_size)),
        "threshold": max(0, min(64, int(threshold))),
        "include_hidden": include_hidden,
    }
    run = dupes.run_similar if mode == "similar-images" else dupes.run_exact
    title = "Finding similar pictures" if mode == "similar-images" else "Finding duplicate files"
    return jobs.start("dupes", title, 0, lambda job: run(job, params)).to_dict()


def start_diskusage(root: str, include_hidden: bool) -> dict:
    folder = walk.folder_root(root)
    return jobs.start("diskusage", "Measuring disk usage", 1, lambda job: diskusage.run(job, folder, include_hidden)).to_dict()


def start_empty_folders(root: str) -> dict:
    folder = walk.folder_root(root)
    return jobs.start("empty-folders", "Looking for empty folders", 1, lambda job: tidy.run_empty(job, folder)).to_dict()


def start_broken(root: str) -> dict:
    folder = walk.folder_root(root)
    return jobs.start("broken-files", "Looking for broken files", 0, lambda job: tidy.run_broken(job, folder)).to_dict()
