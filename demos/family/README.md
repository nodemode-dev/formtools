# formtools demo: A shelf of Form files

The second of formtools' three offline demo pages (the others are `demo/` and `demos/bench/`). It opens in a browser with no engine, no desktop shell and no network: double-click `index.html`, or serve the repository with a static server and open `/demos/family/`.

## A recorded session

Like the other two pages, this is the real formtools window replaying answers recorded from the real engine for the demo folder the engine generates; it does not compute them. It opens the Form Files demo as Home > Demos does in the app (`demo-family`). The status bar reads "Engine replay".

## What it shows

"family" holds a formvis project (`harbour-poster.fvd`, three layers and a stored preview), a two-page PDF invoice, a SQLite database with two tables, the Demo Pixel font built from the generator's own glyphs, a zip archive, CSV, JSON, Markdown, text and Python files, and a `SHA256SUMS` file.

Live in the page: the PDF viewer (pdf.js, on the recorded file), the font preview and its details, the text, Markdown, JSON and code viewers, the CSV and database grids, the archive listing, Hex on the PDF, the font and `SHA256SUMS`, and the browser.

Replayed from the recording: the listings, the project's thumbnail, preview and information, the readings of the text, CSV, database (the first 200 rows of each table), font and archive, Checksums > Verify on `/demo/family/SHA256SUMS`, Checksums (SHA-256 and BLAKE3) of the folder, and Disk Usage.

Needs the engine (the app's own "This needs the formtools engine." message): extracting the archive, installing the font, further database pages, other files, folders and settings, and everything that writes.

## How the page works and how to rebuild it

See `demo/README.md`: the three pages share one bundle under `demo/assets/` and `frontend/vite.demo.config.ts`, `npm run demo` in `frontend/` rebuilds all three, and `scripts/demo-record.py` records `assets/recording.js` again. Credits are in `CREDITS.md`.
