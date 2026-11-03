# HASHOUT_LOG · frontend

Context for the frontend code, kept here instead of in comments.

## v0.2.0 · 2026-11-02 · shell

- Shared family files copied verbatim from formvis 1.98.7 (Apache-2.0), headers included, because the family keeps them byte-identical: `src/ui/themes.ts` (one change: `USER_SKIN_KEY` is `formtools_user_skin`), `src/ui/icons.ts`, `src/ui/dom.ts`, `src/ui/caption-buttons.ts`, `src/styles/tokens.css`, `fonts.css`, `scrollbars.css`, `light-mode.css`. Update them from formvis, never in place, unless the change is formtools-only.
- `index.html` is formvis's, with the theme-boot script kept and its skin key renamed; the terminal-dock boot script and formvis's stylesheet list are gone.
- formtools' own icons live in `src/ui/ft-icons.ts` and are merged into `ICONS` at import, so `icons.ts` stays identical to the family copy. All are original line drawings, 24 px grid, `currentColor` stroke 1.6.
- Shell class names keep the family's `cv-` prefix for the pieces formvis shares (title bar, menus, caption buttons, status, toast, scrim, dialog), so `caption-buttons.ts` and `light-mode.css` work unchanged. formtools' own pieces use `ft-`.
- `menu.ts` is a lean in-window menu bar (no submenus yet). `native-menu.ts` follows formvis's NativeMenus: on macOS in the desktop app the menus are the system's, built from the same `MenuDef` list, and `has-native-menus` hides the in-window bar.
- Command catalogue (`ui/commands.ts`): every command carries `group`, `description` and `useWhen`, the words MCP and the CLI need, so the window bridge in a later phase can expose them without new metadata.
- No i18n yet: English only. Recorded as stubbed in BUILD_NOTES.
- Pages (Home, Browser, Viewer) are built once at start and switched with `hidden`; nothing is rebuilt on navigation.
- Open in its app calls the OS default app through the shell's `open_with_default`. The FormPortal `open_file` hand-off is Phase 10 work.
- Drag and drop: the desktop app uses Tauri's webview drag-drop event (paths), so the shell no longer turns the drop handler off. In a browser tab dropped files have no paths, and a toast says so.

## v0.2.0 · 2026-11-02 · viewer and browser (Phase 2)

- Browser: `patchList` keyed by path; thumbnails load through an IntersectionObserver with a 400 px margin and are decoded off-screen before the `img` is shown, so a tile goes from glyph to picture in one write. Tiles reserve a 4:3 box; `content-visibility: auto` keeps large folders cheap.
- Folder loads keep the old listing on screen until the new one arrives; the busy spinner uses `delayedIndicator` (300 ms delay, 250 ms minimum).
- Viewer: each image is fetched and decoded by a probe `Image` first; its natural size sets the pane's transform in the same frame the `src` is set, so there is no size jump. Native formats load the raw file; everything else goes through `/api/image/view`.
- Prefetch keeps the decoded neighbours (Preferences, default 2 each side) in a promise cache keyed by URL; entries outside the window are dropped.
- Zoom anchors at the pointer; double click toggles fit and 1:1; zoom of 200 percent and above switches to pixelated rendering.
- The histogram is drawn from the decoded probe at most 256 px on the long side.
- Rotate and flip write the file through the engine (`/api/image/transform`), lossless for JPEG where the engine can; the viewer bumps a per-path stamp so the new pixels load instead of the cached ones.
- Quick look: Space in the browser opens the viewer in quick mode, where Space closes it again.
