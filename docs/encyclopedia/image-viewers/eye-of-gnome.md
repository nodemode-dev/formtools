# Eye of GNOME (eog)

The long-standing GNOME image viewer, GTK based, Linux. In GNOME 45 it was replaced as the default by Loupe, which took the "Image Viewer" name; eog continues under a single maintainer who welcomes contributions. This file is deliberately short because the official sources fetched (GNOME GitLab, apps.gnome.org) did not load.

## Facts

- Status: maintained but no longer the default (single source: Catanzaro's GNOME 45 core apps post).
- Decoding: historically through GdkPixbuf, GNOME's older loader library, which glycin can now back through a GdkPixbuf loader shim while the traditional loaders stay on by default.

## Features

- **Plugin system and detail features**: eog was known for plugins and a sidebar of properties, but this is not confirmed in sources fetched, so it is not recorded as fact. formtools note: skip eog as a feature source; use Loupe and gThumb.
- **Lessons**: its replacement happened mainly for memory safety, a new interface and better modern-format handling (per Loupe's author). formtools note: security of untrusted decoders drives viewer rewrites.

## Not verified

- Features, version, license details, plugins, shortcuts.

## Sources

- https://blogs.gnome.org/mcatanzaro/2023/08/17/gnome-45-core-apps-update/
- https://blogs.gnome.org/sophieh/2023/08/30/viewing-images-in-gnome-loupe-and-glycin/
- https://blogs.gnome.org/sophieh/2025/06/13/making-gnomes-gdkpixbuf-image-loading-safer/
