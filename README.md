# Tabletop Product Measure — independent v1.0.0

Start with GUIDE.html (中文操作指南). The original v0.11.0 application is unchanged.

- PC: open index.html, or run start_local_server.bat (Windows PowerShell, no Python).
- Phone camera: host the extracted static files in a NEW HTTPS site. See GUIDE.html.
- Print reference-15x10cm.pdf at Actual Size/100%; verify OUTSIDE edges with a ruler.
- All records are Review Required. No real-device accuracy certification or shelf-fit guarantee.
- Outputs: cropped image ZIP, real XLSX workbook, full JSON backup. No third-party CDNs.
- No backend, account or photo upload. Records persist in this browser's IndexedDB.
- Camera scanning requires native BarcodeDetector support; manual barcode always available.
- Camera relocation invalidates calibration/background; photo upload keeps the selected action workflow.
- Core assumptions: perpendicular camera, approximately central principal point, known flat desk,
  correct distance/thickness bounds, calibrated plane mapping, full object outline in the frame,
  object axes aligned with the reference. Lens distortion is NOT calibrated.

## Source layout
index.html/styles.css: UI; app.js: camera/edit/history; core.js: geometry/detection;
exports.js: XLSX/ZIP; GUIDE.html: guide; reference.html/PDF: calibration;
start_server.ps1/start_local_server.bat: local PC server; tests/core.test.cjs: regression tests.

Run mathematical tests (developer only): node tests/core.test.cjs
See TEST_RESULTS.md for what was actually tested and what was not.
