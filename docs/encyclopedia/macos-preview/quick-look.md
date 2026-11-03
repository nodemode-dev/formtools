# Quick Look

## User features (Apple Mac User Guide)
- Spacebar on selected Finder items opens a floating preview; Space or Esc closes. Works on documents, images, PDFs, audio, video; Apple gives no full type list.
- Multi-select: last selected item shows first; arrows or Left/Right keys browse.
- Index Sheet: grid of all selected items (button or Command-Return).
- Full screen: button top-left; slideshow Play appears in full screen.
- Zoom: Command-Plus / Command-Minus.
- Rotate Left; Option for Rotate Right.
- Markup button opens the Markup toolbar (changes cannot be undone after closing).
- Trim for audio/video: drag yellow handles, Play to test, Revert, Done; replace original or save new file.
- Share button; "Open with [app]" button; double-click opens default app.
- Copy Subject: Control-click image to copy background-isolated subject.
- Live Photo plays automatically; replay button; HDR images shown in HDR when Quick Look window is foreground.
- Also reachable via the Finder Preview pane, Spotlight, links in Live Text, and other apps (Mail, etc.).
- Rumor: macOS 27.2 code references touch gestures for Quick Look. (single source)

formtools note: a spacebar-peek viewer with arrow browsing and an index grid is the signature; include trim and rotate inline.

## Built-in type coverage
Not enumerated by Apple. Evidence: plain text, Office documents, audio (including FLAC), images, PDF, movies, USDZ and RTF/CSV/iWork on iOS controllers. Unknown or dynamic UTIs (e.g. .cfg) fail. XCF has no generator.

## Architecture (developer)
Two eras:
1. Legacy .qlgenerator plugins (loaded by quicklookd) in /System/Library/QuickLook, /Library/QuickLook or app bundle Contents/Library/QuickLook. Still shipped by Apple for built-in types but deprecated for third parties.
2. App extensions: Quick Look Preview Extension (macOS 12 onward per Eclectic Light) and Quick Look Thumbnailing extension (macOS 10.15+).

### Preview extensions
- Principal class conforms to QLPreviewingController (documented availability: iOS 4+, iPadOS 4+, Catalyst 13+, visionOS 1+; macOS listing absent in the symbol metadata fetched).
- View-based: implement preparePreviewOfFile(at:completionHandler:) or preparePreviewOfSearchableItem(identifier:queryString:completionHandler:). Avoid extra presented view controllers, avoid large gesture recognizers (collides with macOS preview behavior), don't hold the file open.
- Data-based (iOS/Catalyst 15+): subclass QLPreviewProvider and implement providePreview(for: QLFilePreviewRequest) returning a QLPreviewReply. Reply forms: from file URL, PDF document with page size, bitmap or vector drawn into a CGContext, or data of a content type (HTML supported with cid: attachments, stringEncoding, custom title).
- Registered via NSExtension in Info.plist with the supported UTIs (supported-content-types key exact name not verified from Apple docs this session).

### Thumbnail extensions
- Subclass QLThumbnailProvider (macOS 10.15+, iOS 11+); implement provideThumbnail(for: QLFileThumbnailRequest, ...) returning QLThumbnailReply.
- Reply options: draw in a context size (current context or provided block) or point to an image file URL; extensionBadge sets the file-type badge on icon thumbnails.
- Clients ask via QLThumbnailGenerator.shared: generateBestRepresentation, generateRepresentations (icon, low-quality, thumbnail), saveBestRepresentation to disk.

### Embedding in apps
- AppKit: QLPreviewPanel (macOS 10.6+) singleton NSPanel following the responder chain; data source and delegate; supports full screen via enterFullScreenMode.
- iOS: QLPreviewController with data source; recognized types: iWork, Office, RTF, PDF, images, public.text, CSV, USDZ.

formtools note: model viewers as pluggable provider modules (preview + thumbnail separately), with time limits and sandboxing like Apple's design; consider an extension API mirroring QLPreviewReply.

## qlmanage CLI
Synopsis (man page): qlmanage -r | -m [name] | -t [-x] [-i] [-s size] [-f factor] [-c contentTypeUTI [-g generator]] [file...] | -p [-x] [-c UTI [-g generator]] [file...] | -h.
- -p preview (floating window), -t thumbnail, -s size, -f scale factor, -c force content type UTI, -g force generator, -x and -i not described in fetched sources.
- -m server info and generator list; -r reset quicklookd; -r cache clears thumbnail cache (Eclectic Light).
- -z reports generation time (Eclectic Light, third-party).
- Debug logging: defaults write -g QLEnableLogging YES (from Apple's archived guide).
- Apple recommends investigating previews that take longer than about two seconds.

formtools note: ship a CLI (formtools preview/thumb) with type/generator overrides and timing flag; mirror -r for cache reset.

## Sources
- https://support.apple.com/guide/mac-help/quick-look-files-mh14119/mac
- https://support.apple.com/guide/mac-help/preview-a-file-mchlgtd_prev01/mac
- https://developer.apple.com/documentation/quicklook/qlpreviewingcontroller.md
- https://developer.apple.com/documentation/quicklook/qlpreviewprovider.md
- https://developer.apple.com/documentation/quicklook/qlpreviewreply.md
- https://developer.apple.com/documentation/quicklook/qlfilepreviewrequest.md
- https://developer.apple.com/documentation/quicklook/qlpreviewcontroller.md
- https://developer.apple.com/documentation/quicklookui/qlpreviewpanel.md
- https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailprovider.md
- https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailreply.md
- https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailgenerator.md
- https://keith.github.io/xcode-man-pages/qlmanage.1.html
- https://developer.apple.com/library/mac/documentation/userexperience/conceptual/quicklook_programming_guide/Articles/QLDebugTest.html
- https://eclecticlight.co/2018/04/05/inside-quicklook-previews-with-qlmanage/
- https://eclecticlight.co/2024/04/05/a-quick-look-at-quicklook-and-its-problems/
- https://www.macrumors.com/2026/06/08/apple-announces-macos-golden-gate/
