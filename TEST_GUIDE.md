# v0.12.0 checks

Automated checks in the development environment:
- JavaScript syntax and DOM selector existence.
- The actual rendered 20 cm reference PDF is recognised by the detector (240 × 240 test image).
- First barcode opens setup; distance/thickness are required before camera start.
- Successful 3-sample reference calibration stores separate X/Y scale.
- Next barcode does not reopen calibration; per-item thickness resets.
- Detect New Object opens a barcode prompt before or after a measurement.
- Empty/invalid thickness is blocked; zero thickness is accepted.
- Depth interval geometry tested for centred and off-centre frames.
- Saved record includes thickness, distance, method and corrected estimate.
- Changing setup with an unsaved measurement prompts the save decision.
- Legacy and new history export to valid XLSX with 14 columns, verified by openpyxl.
- Missing reference blocks completion; stopping/reopening camera invalidates scale.
- Missing image storage shows Unavailable without breaking the history table.

These checks use simulated DOM/camera data, not a physical phone. Browser UI screenshots could not be tested in this environment because the browser executable was unavailable. PDF layout was rendered and visually checked.

First phone check:
1. Follow README.md to deploy and calibrate.
2. Measure a rigid rectangular product with a ruler; compare H/V and entered thickness.
3. Try a bottle/soft pouch; ensure the manual frame includes every visible edge.
4. Measure several barcodes; confirm Camera Setup stays closed between products.
5. Change stand height using Camera Setup; verify a new reference and empty background are required.
6. Save a record, open History and share Excel / image ZIP.
7. Treat the output as shelf planning estimates, not certified dimensions or a guaranteed ±5% measurement.
