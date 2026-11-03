# Lightweight PDF Utilities

The family already has a dedicated PDF app. This file covers only the convert, merge, split, compress layer that a utility belt would expose. Research date: 2026-11-03.

## PDF24 tool list (web/desktop, closed-source freeware)

Categories from the site: Create (images to PDF, webpage to PDF, forms, QR), Invoices (e-invoice create and validate), Edit (annotate, fill, watermark, page numbers, crop, resize, metadata), Organize (merge, split, assemble, rearrange, remove, extract, rotate, booklet, bookmark, extract images), Optimize and repair (compress, grayscale, web optimize, OCR, repair, rasterize, flatten, PDF/A), Security (protect, unlock, sign, redact, strip metadata), View and check (compare, search, verify signatures, PDF/A check), Convert to PDF (Office, OpenDocument, images incl. HEIC/WEBP/SVG/TIFF, RTF, EPUB, Markdown, text), Convert from PDF (Word, PowerPoint, Excel, images, SVG, TIFF, text, RTF, EPUB, HTML, Markdown, PDF/A). Desktop apps: PDF24 Creator, PDF Printer, PDF Reader. License terms not checked. (single source)

## Stirling-PDF

- Self-hosted web UI plus REST API and desktop app (Windows, Mac, Linux, works offline). Claims 50+ tools, 40+ languages, no-code automation pipelines. Docs groups: Page Editor, annotate, compare, compress, convert, fill forms, mobile scanner, OCR, page operations, redact, automate, sign, certificate signing, AI assistant.
- Run with Docker (`docker run -p 8080:8080 stirlingtools/stirling-pdf`).
- License: root LICENSE is MIT (Stirling PDF Inc.), but several directories (proprietary, saas, engine, desktop frontend, cloud and others) carry separate licenses not read here. The site calls it open-core. Treat reuse of the whole product as non-trivial; reuse of the MIT parts needs per-directory checking.

## Open engines

| Engine | Capability | License |
|---|---|---|
| qpdf | linearize, encrypt (AES-256), split, merge, inspect; no rendering or text extraction; C++ library plus CLI | Apache-2.0 (Artistic 2.0 before v7) |
| pdfcpu | Go; validate, optimize, split, merge, trim, encrypt, watermark, stamps, images, fonts, forms, signatures validation, attachments | Apache-2.0 |
| Ghostscript | rendering and rewriting (compression via re-distill) | AGPL or commercial from Artifex |
| Tesseract | OCR to searchable PDF | Apache-2.0 |

- Ghostscript's AGPL is the main license hazard for a distributed app.

## Recommended lightweight tool set for formtools

1. Merge, split by range or every N pages, extract and rotate pages.
2. Compress (image downsampling presets).
3. Images to PDF, PDF to images.
4. Strip metadata; add or remove password.
5. OCR to searchable PDF as optional add-on.

formtools note: qpdf and pdfcpu cover structure-only operations under Apache-2.0; image-resampling compression needs a renderer or image pipeline and is the hard part.

## Sources

- https://tools.pdf24.org/en/all-tools
- https://github.com/Stirling-Tools/Stirling-PDF
- https://github.com/Stirling-Tools/Stirling-PDF/blob/main/LICENSE
- https://docs.stirlingpdf.com/
- https://github.com/qpdf/qpdf
- https://github.com/pdfcpu/pdfcpu
- https://ghostscript.com/licensing/index.html
- https://github.com/tesseract-ocr/tesseract
