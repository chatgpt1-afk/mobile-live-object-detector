# Phase 1 — Live Object Frame Test

This project tests only:

`Mobile camera → live foreground detection → moving bounding box`

It does **not** measure centimetres and does not use the previous Front/Side/Top workflow.

## Test A — First verify it on the computer

1. Extract the ZIP.
2. Double-click `start_local_server.bat`.
3. Open Chrome or Edge.
4. Go to `http://localhost:8000`.
5. Click **Start Camera**.
6. Allow camera permission.
7. Place one object in front of a plain background.
8. Move the object and check whether the green bounding box follows it.

Do not double-click `index.html` directly. Camera access requires a web origin such as localhost or HTTPS.

## Test B — Difficult background

1. Fix the camera position.
2. Remove the object.
3. Click **Set Empty Background**.
4. Do not move the camera.
5. Place the object in the scene.

This method is useful for white, black, mesh or low-contrast objects. If lighting changes or the phone moves, set the empty background again.

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
8. Tap **Start Camera** and allow camera access.

## What to record during the test

Test at least:

- one dark item on a light background;
- one light item on a darker background;
- one mesh or hollow item;
- slow camera movement;
- slow object movement;
- object partly outside the camera picture.

For every test, record:

- Does the box cover the complete object?
- Does it include shadows?
- Does it jump to the background?
- Does it continue following while the object moves?
- Does **Set Empty Background** improve the result?

## Detection settings

- **Foreground sensitivity:** lower value detects smaller colour differences but may include shadows/noise. Higher value is stricter.
- **Minimum object size:** increase it if the system frames small background marks. Decrease it for very small products.

## Current Phase 1 limitations

- It detects the main foreground region; it does not recognise product names or categories.
- Auto Background works best with a plain background.
- Empty Background mode requires the phone to remain still after calibration.
- Transparent, reflective and very low-contrast items remain difficult.
- No centimetre dimensions are calculated in this phase.
