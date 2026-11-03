# utilities HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## 2026-11-03 · v0.4.0 · utilities tool

### Layout

- `walk.py`: the shared `os.scandir` walker (never follows symlinks, skips unreadable entries and counts them through `Tally`, which also records each as a job error), `Progress` (growing totals), root validation and the bounded `parallel` thread helper that calls `job.check()` between items. `dupes.py`, `diskusage.py`, `tidy.py` (empty folders, broken files), `locks.py`, `templates.py`, `trash.py`, `service.py` (job starters shared by HTTP and MCP), `router.py`, `__init__.py` (tool `utilities`, six MCP tools).
- Long work runs on the shared job queue: kinds `dupes`, `diskusage`, `empty-folders`, `broken-files`. Trash, locks and templates are synchronous.

### Duplicates

- Exact: group by size, 64 KB head plus tail xxh64 (head only when the file fits in 64 KB), then full blake3 read in 1 MB blocks with `job.check()` per block. Hashing uses 4 threads. Zero-byte files are excluded by the default `min_size` of 1.
- Hard links: files sharing (device, inode) are collapsed before hashing and listed after their representative. They are not counted as waste, so `wasted` is `size * (distinct inodes - 1)`, and a group of only hard links to one inode is dropped.
- Similar images: dHash of the 9x8 grayscale of `decode.render(path, 256)`, 64 bits. Unique hashes go into a BK-tree (Hamming distance) and matches are joined with union-find, so a group is a connected chain (A near B, B near C puts all three together). That can merge more at high thresholds. Identical hashes are always grouped. SVG and JXL are skipped (render refuses them). Width and height come from the file header with EXIF orientation applied. 5,000 generated pictures (500 near-duplicate pairs) took 3.5 s.
- `scanned` is the number of files that passed the size and kind filters (pictures only in similar mode). Extra keys beyond the contract: `wasted` per group, `errors` and `mode` on the result. Files in a group: exact sorted oldest first; similar sorted by pixel count then size, largest first. Group `size` in similar mode is the largest member.
- Hidden files and folders are skipped unless `include_hidden`; the same file reached through two roots is counted once.

### Disk usage

- Tree from an explicit-stack post-order walk (no recursion limit). Each folder keeps its 60 largest children (files and folders compete) and folds the remainder into `{"name": "Other (n items)", "other": true}` with summed size, files and dirs. Folders at depth 8 (root is 0) are leaves with `children: []` that still carry the totals of everything below. Nodes carry `dir` (bool); the root also carries `errors`.
- Sizes are apparent size (`st_size`); a hard-linked file is counted once per scan. Symlinks are skipped, not measured.

### Empty folders and broken files

- Empty folder means no non-folder entry anywhere beneath it. A symlink (even to a folder), a socket or an unreadable folder makes its parent non-empty. Hidden files count as files. The result adds `top` (outermost empty folders) and `errors` to the contract's `folders`; the scan root itself is never listed.
- Broken: pictures that fail `decode.render(path, 64)`; formats the build does not decode (RAW without rawpy, HEIC off macOS, and so on) are skipped, not flagged. Media files are probed through `probe.raw` when `ffprobe` is found; the media module is imported lazily and the check is skipped when it is missing (`media: false` in the result). Result also has `checked`.

### Locks

- psutil `open_files()` per process, plus the working directory when the target is a folder; a folder matches anything open beneath it. Processes that deny access are skipped and not counted; `supported` is false only when psutil is missing or no process could be examined. `examined` is an extra key. Memory-mapped files are not inspected.

### Templates

- Folder `data_dir()/templates`. Seeding writes each seed with exclusive create and then a hidden `.seeded` marker, so later starts never recreate or overwrite anything, including items the person deleted or edited. Hidden entries are not listed.
- Create: folders copy with `copytree` (symlinks kept as links), files byte for byte with their timestamps. The target name is claimed with exclusive create or `mkdir`, so a taken name becomes `name (2)`, `name (3)`. When `name` has no extension, the template's extension is added. Names with separators or `..` are refused. No name variable expansion in this version.

### Trash

- Only `send2trash`; nothing here calls `os.remove` or `shutil.rmtree`. Roots of drives and the home folder are refused. Up to 5000 paths per call; a failure on one path is reported and the rest continue. The MCP tool description says it moves to the trash.

### Not done

- No cached hash store between runs (the research notes suggest one); no reference folders; no hardlink-dedup action.
