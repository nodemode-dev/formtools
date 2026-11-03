# utilities HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## 2026-11-03 · v0.6.0 · Disk usage heatmap and types

Additive to the v0.4.0 contract: every earlier key, the 60-children fold, depth 8 and `errors` are unchanged, so an older window keeps working.

- `categories.py` holds the one extension table. Thirteen categories: images, raw, video, audio, documents, code, data, archives, 3d, fonts, apps (exe, dll, so, dylib, pkg, dmg, deb, rpm, msi, app bundles, plus compiled objects and an extensionless file with an execute bit), system (folder names, below) and other. `GROUPS` reuses `core/filetypes.py` for images (minus raw), raw, video, audio, 3d, fonts and archives, and lists documents, code, data and apps itself, because `filetypes.TEXT` lumps code, data and documents together. Where a set overlaps, the later group in `ORDER` wins; `jar`, `war` and `ear` stay archives, `svg` is an image, `obj` is 3d, `dmg` and `pkg` are apps. `libfoo.so.6` is read as `so`. Names without an extension (Makefile, Dockerfile, LICENSE, README) have their own small table.
- System and caches is decided by folder, and the first matching ancestor wins for everything beneath it: `.cache`, `caches`, `cache`, `node_modules`, `__pycache__`, `target`, `.git`, `.gradle`, `.npm`, `.yarn`, `.pnpm-store`, `.tox`, `.mypy_cache`, `.pytest_cache`, `.ruff_cache`, `.next`, `.nuxt`, `.parcel-cache`, `.nuget`, `temp`, `tmp`, `$recycle.bin`, trash and spotlight folders (case-insensitive). Folders ending `.app`, `.framework`, `.bundle`, `.xpc`, `.appex`, `.plugin` or `.kext` force apps. `target` and `temp` are common names for ordinary folders; the table accepts that false positive rather than inspecting contents. `.pyc` files under a `__pycache__` land in system, which is why `/usr` shows 3.5 percent there.
- Every node carries `types` (category to apparent bytes, summing exactly to `size`) and `allocated`. File nodes add `ext` (lower case, no dot, empty when there is none) and `category`. The folded "Other (n items)" node carries the summed `types` and `allocated` of what it folds. Folders past depth 8 still carry the totals of everything below.
- `allocated` is `st_blocks * 512` where the OS reports blocks (so sparse files can be far smaller than their size, and small files round up to the filesystem block). Without blocks (Windows) it is the size rounded up to 4096. `stats.allocation` says which one was used (`blocks` or `rounded-4096`). A hard link counted a second time adds 0 to both size and allocated.
- Root `stats`: `by_type` [{category, bytes, allocated, files}] sorted by bytes; `by_ext` the top 40 by bytes, keyed by extension and category, so `js` under `node_modules` (system) and `js` elsewhere (code) are two rows; `largest` the top 50 files by size with path, size, allocated, mtime, ext, category (a bounded min-heap, so it does not depend on the 60-child fold); `files`, `folders`, `errors`, `apparent`, `allocated`, `average_file` (apparent over files), `newest` and `oldest` mtimes (seconds, null for an empty scan), `hardlinks_counted_once`, `allocation`.
- Hard links: an inode (device, inode) is counted once in every total. `files` still counts directory entries, as the tree always did, and `hardlinks_counted_once` is how many extra entries were not counted (6 under `/usr`).
- Speed: the per-file work grew by an extension split, a table lookup, a type tally, an extension tally and a heap check. Locals are used inside the folder loop and totals are added once per folder. The scan also pauses the cyclic collector for its duration (restored in `finally`): the tree is acyclic and the collector spent its time walking millions of fresh tuples and dicts. Measured on `/usr` (125,876 files, 15,380 folders), in process, five runs each, interleaved: before 0.72 to 0.78 s best, after 0.81 to 0.82 s best (about 8 percent). Through the engine over HTTP, warm cache: before 1.24 s, after 1.27 to 1.41 s; the first scan after a cold start was 3.10 s before and could not be re-measured cold (dropping the page cache needs a shared machine to be left alone). Without the collector pause the same code measured 1.0 to 1.4 s in process, so that change is what keeps the cost small. The result grew from 10.1 MB to 15.1 MB of JSON (types on every node).
- Checked on `/usr` and a small tree: `types` sums to `size` on all 66,134 nodes of `/usr`, `by_type` sums to the root size, allocated and files, a hard link, a sparse 10 MB file (allocated 0) and a 5 KB picture are classified and measured as described.
- Not done: by-type `allocated` and `files` are root-only (a folder node has bytes per type, not blocks per type); the extension of a file inside a forced-system folder is still its own extension.

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
