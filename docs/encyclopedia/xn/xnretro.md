# XnRetro

## What it is
A one-window photo effects app for vintage and instant-camera looks. Version 1.30 on desktop.

## Platforms
Windows 32/64-bit (zip), Linux 32-bit TGZ, macOS via Mac App Store (store version 1.29, updated 2014-03-20, macOS 10.5+, free). A forum user reported the Linux build failing on 64-bit Arch (single source). Mobile versions exist (see xnsoft-mobile-apps.md).

## Features
- 20 colour effects (names not listed on the page).
- 15 light effects, including bokeh and leak.
- 28 frame borders; the App Store lists instant, lomo and grunge styles.
- Adjustments: contrast, gamma, saturation.
- Vignetting and noise.
- Save, email or share (store listing names Flickr, Facebook, Twitter, Tumblr).
UI flow: open photo, pick colour effect, light effect, frame, tweak sliders, save. Detailed layout not documented (not verified). Presets, formats and licence terms are not stated.
formtools note: the effect stack is colour LUT, light overlay, frame, then vignette and noise; implement as ordered layers with per-layer opacity.
formtools note: ship frames and light leaks as bundled asset packs, not code.

## Could not verify
Names of the 20 colour effects, 15 light effects, 28 frames; supported file formats; licence; changelog (official one not found).

## Sources
- https://www.xnview.com/en/xnretro/
- https://forum.xnview.com/viewtopic.php?p=166595
- https://apps.apple.com/us/app/xnretro/id545999443?mt=12
