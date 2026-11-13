# formtools demo: A photo shoot

An offline demo of formtools that opens in a browser with no engine, no desktop shell, no network and no CDN. There are three pages; the other two are `demos/family` (A shelf of Form files) and `demos/bench` (3D and media bench), and each page links to the others from the status bar.

## Open it

- Double-click `demo/index.html` (it works from `file://`), or
- serve the repository with any static server, for example `python3 -m http.server 8000`, and open `/demo/`.

Every script, style, font and recorded answer is local to the repository.

## A recorded session

formtools does its real work in its engine, on files on your computer, so this page cannot do that work itself. It is the real formtools window replaying answers recorded from the real engine: the recorder ran the engine on the demo folder it generates, asked it everything the window asks when the folder is browsed, its files are opened and the read-only tools run on it, and saved those answers in `assets/recording.js`. The page replays them; it does not compute them. The engine's data folder appears as `/demo`, and the status bar reads "Engine replay".

The page is not a look-alike: `frontend/index.html` and the application's own entry (`frontend/src/main.ts`, then `app.ts` and every module under `ui/` and `io/`) are bundled as they are. When the window is ready the page opens the Photo Shoot demo exactly as Home > Demos does in the app, through the same `demo-photos` command, while `html[data-demo]` keeps the window hidden, then shows it once, complete.

## What it shows

"photos" is the folder the engine generates for the demo: twenty-three pictures with invented camera data and dates, JPEG, PNG with alpha, WebP in a sub-folder, a 16-bit TIFF and an EXR, identical copies, an edited copy, a smaller copy and a web-sized copy to find as duplicates, one broken JPEG and an empty "to sort" folder.

Live in the page (the window's own code, working on recorded bytes):

- the browser: grid and list, sort, filter, thumbnail size, selection, the folder tree and Places;
- the image viewer: zoom, fit, compare, the histogram and the pixel inspector, next and previous;
- menus, the command palette, themes, light and dark, and Preferences.

Replayed from the recording (the engine's answers, as it gave them):

- the folder listings, thumbnails and picture previews; the 16-bit TIFF and the EXR are the engine's own renderings;
- the information panel with each picture's size, format and camera data;
- Find Duplicates on the folder, identical content and similar pictures, with the default settings;
- Clean Up: the broken JPEG and the empty folder;
- Disk Usage of the folder, and Checksums (SHA-256 and BLAKE3) of the folder.

To keep the page small, the 1600 px JPEGs are replayed as the engine's own 1024 px previews of them; the information panel still reports the files' real sizes.

## Needs the engine

Anything that was not recorded answers with the app's own message: "This needs the formtools engine." That covers other folders and your own files, every action that writes a file (Batch Convert, Resize, Rename, rotating, ratings and labels, moving to the trash), other tool settings, the terminal, Claude Code and the Chat, and the desktop utilities. `src/shim/api.ts` answers each `/api` request from the recording or with that message, serves recorded pictures and media as in-page blobs, and closes sockets to the engine quietly.

## Rebuild

The built files in this folder and in `demos/` are committed. After changing the app or `demo/src`:

```sh
cd frontend
npm ci
npm run demo
```

`npm run demo` runs `vite build --config vite.demo.config.ts` three times, with `--mode photos`, `family` and `bench`. The three pages share one script, stylesheet and font set, written once to `demo/assets/`; `demos/family/index.html` and `demos/bench/index.html` load them from there and carry only their own `assets/recording.js`. `npx tsc --noEmit -p ../demo` type-checks the page code.

To record the answers again, start the engine (`./formtools backend`), then from the repository root run the recorder with the engine's Python:

```sh
python -B scripts/demo-record.py --engine http://127.0.0.1:8240
```

The engine makes its demo folders if they are missing. The recorder rewrites the data folder to `/demo` and stops without writing if any answer still names the computer it ran on.

## Licences

The bundle contains the app's own code (Apache-2.0), Inter and JetBrains Mono (OFL 1.1, via @fontsource), three.js (MIT), pdf.js (Apache-2.0), highlight.js (BSD-3-Clause), markdown-it (MIT), xterm.js (MIT) and the Tauri JavaScript API (Apache-2.0 or MIT), all already in `frontend/package-lock.json` and `NOTICE.md`. See `CREDITS.md`.
