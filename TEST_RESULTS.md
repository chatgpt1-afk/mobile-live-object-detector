# Validation report — 2026-10-05

## Passed
- JavaScript syntax checks: app.js, core.js, exports.js.
- 12 core regression checks: plane mapping, calibration rejection, depth-interval envelope,
  off-centre envelope, projected rectangular solids at varied depths, upward rounding,
  allowance, 5% depth-budget gate, invalid inputs, physical axis mapping, missing dimensions,
  background detection, optional mild-shadow suppression, reference rectangle suggestion.
- DOM/canvas/IndexedDB simulation: initialise all element bindings; reference/background/
  object/frame/measurement/save workflow; reject unconfirmed frame and blank thickness;
  duplicate cancel/keep/replace; next-item cancel/discard; save measured view without Add View;
  retain confirmed views while invalidating setup.
- XLSX opened with openpyxl. Barcode leading zeros retained as text, missing dimension blank,
  review status present, two worksheets readable, ZIP CRC verified.
- Printable A4 PDF rendered and visually inspected. Outer reference rectangle is generated
  at exactly 150 x 100 mm in the PDF. Actual printed size must still be checked with a ruler.
- Static HTML references and app element IDs checked; ZIP archive integrity checked.
- Original uploaded v0.11.0 ZIP left unchanged.

## Not verified here
- Real browser layout and real phone getUserMedia/BarcodeDetector/Web Share behaviour.
  The container had no browser installed; the browser download failed. The workflow test
  uses a simulation, not Playwright or a physical device.
- Windows PowerShell local server execution: this environment is Linux.
- Real product accuracy, lens distortion, exposure changes, shadows on your actual desk,
  maximum-size products, soft/transparent/glossy packaging, or real shelf-fit outcomes.
- No hosted website was deployed.

All saved records intentionally remain Review Required. A depth-scale budget within 5%
is not a total error bound or accuracy certification. See GUIDE.html before production use.
