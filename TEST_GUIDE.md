# Phase 2B — Live Object Measurement Test

This project tests only:

`Mobile camera → live foreground detection → moving bounding box → Capture → 5 cm reference measurement`

It measures the captured view's Horizontal × Vertical size. It does not infer a third dimension and does not use the previous Front/Side/Top workflow.

## Print the black-and-white reference marker

1. Open `reference/5cm_reference_marker.pdf`.
2. Print using **Actual Size / 100%**. Never choose Fit, Shrink or Scale to Page.
3. Black-and-white printing is supported; colour ink is not required.
4. Measure the outer black square with a ruler. It must be exactly 5.00 cm × 5.00 cm.
5. Cut along the outer cut line without cutting the black square.
6. Keep the marker flat and place it beside the object in the same measurement plane.
7. Use one cut-out marker and leave a visible gap between the marker and the item. Do not use the full sheet containing all four marker copies.

## Test A — First verify it on the computer

1. Extract the ZIP.
2. Double-click `start_local_server.bat`.
3. Open Chrome or Edge.
4. Go to `http://localhost:8000`.
5. Click **Open Camera** while the background is empty.
6. Allow camera permission.
7. With the scene still empty, click **Set Empty Background** and keep the phone still.
8. Place one object and the marker in front of the saved background without moving the phone.
9. Click **Detect Object**.
10. Confirm the green frame contains the item and the cyan frame contains the 5 cm marker.
11. Tap the round Camera icon beside the live view.
12. Review the suggested frame. Choose **Use System Frame** or **Manual Frame**.
13. In Manual Frame, drag inside the frame to move it and drag any handle to resize it. Test Undo, Redo and Reset.
14. Tap **Confirm Frame & Measure**.
15. Confirm the final image contains the frame, Horizontal cm and Vertical cm. The image downloads automatically.

Do not double-click `index.html` directly. Camera access requires a web origin such as localhost or HTTPS.

## Test B — Difficult background or small object

1. Choose the final camera position and distance.
2. Keep the scene empty and click **Open Camera**.
3. Click **Set Empty Background** and wait for `Empty background saved`.
4. Place the object and marker without moving the phone.
5. Click **Detect Object**. The green frame follows the main item and the cyan frame follows the marker.
6. Live marker detection does not block Capture. Marker and item identification happen after the photo is captured.
7. If the live green item frame is not found, Capture remains available so the frozen photo can still be analysed.

Small hand movements are compensated automatically. If lighting, zoom, camera distance or camera angle changes clearly, remove the item and marker, then tap **Set Empty Background Again**.

For a small item, move the phone to the desired position **before** calibration. Do not move closer after calibration. The default minimum size is now 0.2%; lower it to 0.1% only when necessary.

## Test C — Real phone

Mobile browsers normally block camera access on an ordinary `http://192.168.x.x` address. The page must be served through HTTPS.

The easiest free test is GitHub Pages:

1. Create a new GitHub repository, for example `live-object-frame`.
2. Upload all files from this folder to the repository root.
3. Open repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**, then click **Save**.
6. Wait for GitHub to show the HTTPS website address.
7. Open that address on the phone using Chrome or Safari.
8. Tap **Open Camera** and allow camera access.

## What to record during the test

Test at least:

- one dark item on a light background;
- one light item on a darker background;
- one mesh or hollow item;
- slow camera movement;
- slow object movement;
- object partly outside the camera picture.

For every test, record:

- Does the green box cover the complete item without expanding to the marker or background?
- Does it include shadows?
- Does it jump to the background?
- Does it continue following while the object moves?
- Does reopening Camera with an empty scene improve the result?
- Does Capture become available after the frame stops moving?
- Does the cropped preview include the complete object without excessive background?

## Detection settings

- **Foreground sensitivity:** lower value detects smaller colour differences but may include shadows/noise. Higher value is stricter.
- **Minimum object size:** increase it if the system frames small background marks. Decrease it for very small products.

## Current Phase 2B limitations

- It detects the main foreground region; it does not recognise product names or categories.
- Empty-background setup is manual so the user controls the exact empty scene and camera position.
- Live view frames the capture area only; the frozen captured photo is used for marker detection and measurement.
- Normal small hand movements are compensated. Moving much closer, zooming or changing the camera angle still changes the scene geometry and requires reopening Camera with an empty scene.
- Transparent, reflective and very low-contrast items remain difficult.
- The system measures only the current 2D Horizontal × Vertical view; it does not infer a third dimension.
