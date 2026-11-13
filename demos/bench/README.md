# formtools demo: 3D and media bench

The third of formtools' three offline demo pages (the others are `demo/` and `demos/family/`). It opens in a browser with no engine, no desktop shell and no network: double-click `index.html`, or serve the repository with a static server and open `/demos/bench/`.

## A recorded session

Like the other two pages, this is the real formtools window replaying answers recorded from the real engine for the demo folder the engine generates; it does not compute them. It opens the 3D and Media demo as Home > Demos does in the app (`demo-bench`). The status bar reads "Engine replay".

## What it shows

"bench" holds a GLB scene of three primitives, one primitive each as OBJ, STL, PLY and OFF, a cube 100 units on a side for measuring, a frequency sweep and a chord as WAV, and a short WebM drawn frame by frame.

Live in the page: the 3D viewer (three.js) with its views, shading modes, measuring and screenshots on the recorded model files, audio and video playback of the recorded files, and the browser. The 3D viewer needs WebGL.

Replayed from the recording: the listings, each model's information, the OFF model as the engine's GLB conversion for viewing, media information, the waveforms, the video's poster, Checksums (SHA-256 and BLAKE3) of the folder, and Disk Usage.

Needs the engine (the app's own "This needs the formtools engine." message): converting models, snapshots and remuxing, other files, folders and settings, and everything that writes.

## How the page works and how to rebuild it

See `demo/README.md`: the three pages share one bundle under `demo/assets/` and `frontend/vite.demo.config.ts`, `npm run demo` in `frontend/` rebuilds all three, and `scripts/demo-record.py` records `assets/recording.js` again. Credits are in `CREDITS.md`.
