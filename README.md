# Mobile Live Object Detector — Phase 1

Free, dependency-free Mobile Web/PWA prototype for live camera object framing.

## Included

- Rear-camera request on supported phones
- Live foreground detection
- Smoothed bounding box that follows the detected object
- Edge warning when an object may be cut off
- Required averaged empty-background calibration for stable detection
- Automatic compensation for normal small hand-held camera shifts
- Live framing of the combined item + reference-marker capture area
- Shadow suppression and small-item detection down to 0.1% of the frame
- Adjustable sensitivity and minimum object size
- Stable-frame Capture button
- High-resolution photo capture and automatic object crop
- Immediate pixel-size, camera-resolution and frame-coverage analysis
- Automatic black-and-white printed 5 cm reference-marker detection
- Marker and item analysis from the frozen high-resolution captured photo
- 2D Horizontal × Vertical centimetre measurement
- Mobile Save to Photos / Share workflow with download fallback
- Simplified Open Camera → Detect Object → Capture flow
- Floating Camera capture icon inside the live-view area
- Offline PWA cache after the first successful HTTPS visit

## Not included in Phase 1

- Width / Length / Height calculation
- ArUco measurement
- Front / Side / Top photo mapping
- Product classification
- Third-dimension measurement from a single 2D view

See `TEST_GUIDE.md` for step-by-step testing.
