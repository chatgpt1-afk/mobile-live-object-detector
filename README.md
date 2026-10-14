# Mobile Detector On Item v0.13.7 — Dual View

One barcode, two capture slots. Choose Upright or Horizontal before measuring. Image 1 is Front. Image 2 is Side, Top, or Blank. Confirm each capture with Manual Frame and Manual Marker as needed. Use arrows or swipe on capture result to switch. Save Item writes one record with two image entries, and Excel export contains Image Details and Item Dimensions sheets.

For Blank second image, the missing dimension is saved empty and status Review Required. Never invent a third dimension. Both photos use the same barcode, with placement/view included in image filenames. Images are kept in local IndexedDB until exported.

Use GitHub Pages URL with ?v=0132 after replacing all files. Check the displayed version 0.13.7. The app is not yet validated on a physical phone.

Version 0.13.7: Item Dimensions Excel sheet now embeds the cropped Front View image in the Front Photo column. Photos are stored in the XLSX itself and not merely linked.

Version 0.13.7: Upload Image imports a saved photo directly into marker detection and adjustable manual frame review without requiring camera/background calibration. Marker pattern matching tests four right-angle orientations.

## v0.13.7
- Capture remains available whenever the camera stream is ready, even without successful live object/marker detection or background calibration.
- Manual Marker and Manual Frame can be selected in either order; selecting one exits the other's drag mode.
- The barcode dialog requires an independently captured or uploaded Item Photo before continuing.
- The Item Dimensions workbook sheet embeds this Item Photo, not the cropped front measurement frame. Existing saved records from older versions may not have a separate Item Photo.

History: View History now opens two choices (Image Details / Item Dimensions) before showing either table.
