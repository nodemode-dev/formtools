# XnRetro

## What it is
A one-window photo effects app for vintage and instant-camera looks. Version 1.30 on desktop.

## Platforms
Windows 32/64-bit (zip), Linux 32-bit TGZ, macOS via Mac App Store (store version 1.29, updated 2014-03-20, macOS 10.5+, free). A forum user reported the Linux build failing on 64-bit Arch (single source; the vendor archive's Linux files are old 32-bit-era builds, 1.01 in x64 and 1.26 in a single tgz, which fits such failures). Mobile versions exist (see xnsoft-mobile-apps.md).

## Features
- 20 colour effects (names not listed on the page or in the vendor's announcement post; the program labels its effect thumbnails only "Retro 1", "Retro 2" and so on, so there are no descriptive names to document. Read from the vendor's Linux build, which is version 1.26 of 2013 not 1.30, so the effect set could differ).
- 15 light effects, including bokeh and leak. The build's light list file names them: Bokeh 1 to 4, Leak 1 to 8, plus three entries all titled "box5" (that is 15 items, matching the page count).
- 28 frame borders. The build's frame list file names them: Frame1 to Frame10, Black, Border1 to Border4, Retro, Dogtown, Instant, Provini, Instant2, Roid1, Roid2, Aged, Filmroll, Frame 10, Frame 11, Frame 12, Halftone (28 items, matching the page count). The App Store lists instant, lomo and grunge styles.
- Vignettes: five vignette images ship (vignette plus vignette3 to vignette6); the UI offers "No Vignette" or a numbered vignette, "No Overlay" for light, "No Frame" for frames.
- Adjustments (slider labels in the build): brightness, contrast, saturation, gamma, exposure, red, green and blue balance, light opacity, vignetting, noise, and a "Square output" checkbox.
- Save, email or share (store listing names Flickr, Facebook, Twitter, Tumblr).
UI flow: open photo, pick colour effect, light effect, frame, tweak sliders, save. Detailed layout not documented (not verified). Presets, formats and licence terms are not stated.
formtools note: the effect stack is colour LUT, light overlay, frame, then vignette and noise; implement as ordered layers with per-layer opacity.
formtools note: ship frames and light leaks as bundled asset packs, not code.

## Could not verify
Names of the 20 colour effects (the program has none beyond numbering); supported file formats; licence; changelog (official one not found). Linux build mismatch: the page offers a Linux download under version 1.30, but the vendor archive's newest Linux file is 1.26 dated 2013-04-05 (1.30 exists only as Windows zip 2021-06-14 and a Mac dmg 2020-12-14), and the "XnRetro-linux.tgz" link on the page gives the 1.26 build. The announcement post of 1.30 is dated 2020-12-14 and repeats the same feature list.

## Sources
- https://www.xnview.com/en/xnretro/
- https://forum.xnview.com/viewtopic.php?p=166595
- https://apps.apple.com/us/app/xnretro/id545999443?mt=12
- https://download.xnview.com/XnRetro-linux.tgz (vendor build, v1.26; frame, light and vignette lists and UI strings read, not run)
- https://download.xnview.com/versions/XnRetro/ (vendor archive with dates)
- https://newsgroup.xnview.com/viewtopic.php?t=41262 (vendor announcement of 1.30, 2020-12-14)
- https://www.xnview.com/wiki/index.php/XnConvert (fetched 2026-11-03: redirects to forum, wiki gone)
