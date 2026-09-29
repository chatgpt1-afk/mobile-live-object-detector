"use strict";

const video = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const overlayCtx = overlay.getContext("2d");
const workCanvas = document.querySelector("#processingCanvas");
const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
const startButton = document.querySelector("#startButton");
const detectButton = document.querySelector("#detectButton");
const captureButton = document.querySelector("#captureButton");
const captureResult = document.querySelector("#captureResult");
const closeResultButton = document.querySelector("#closeResultButton");
const capturedPreview = document.querySelector("#capturedPreview");
const pixelSize = document.querySelector("#pixelSize");
const imageSize = document.querySelector("#imageSize");
const frameCoverage = document.querySelector("#frameCoverage");
const horizontalSize = document.querySelector("#horizontalSize");
const verticalSize = document.querySelector("#verticalSize");
const referenceScale = document.querySelector("#referenceScale");
const downloadCapture = document.querySelector("#downloadCapture");
const saveToPhotos = document.querySelector("#saveToPhotos");
const thresholdInput = document.querySelector("#threshold");
const minAreaInput = document.querySelector("#minArea");
const thresholdValue = document.querySelector("#thresholdValue");
const areaValue = document.querySelector("#areaValue");
const cameraState = document.querySelector("#cameraState");
const detectionStatus = document.querySelector("#detectionStatus");
const confidenceText = document.querySelector("#confidence");
const fpsText = document.querySelector("#fps");
const markerStatus = document.querySelector("#markerStatus");
const liveMessage = document.querySelector("#liveMessage");
const emptyState = document.querySelector("#emptyState");

const PROCESS_WIDTH = 320;
const PROCESS_INTERVAL_MS = 80;
const SMOOTHING = 0.32;

let stream = null;
let running = false;
let lastProcessed = 0;
let previousTick = performance.now();
let backgroundFrame = null;
let smoothedBox = null;
let missingFrames = 0;
let movedBackgroundFrames = 0;
let stableFrames = 0;
let previousDetectionBox = null;
let lastValidBox = null;
let captureUrl = null;
let capturedBlob = null;
let capturedFilename = "object-capture.jpg";
let lastMarker = null;
let lastMeasurementBox = null;
let detectionActive = false;

thresholdInput.addEventListener("input", () => {
  thresholdValue.value = thresholdInput.value;
});
minAreaInput.addEventListener("input", () => {
  areaValue.value = `${(Number(minAreaInput.value) / 10).toFixed(1)}%`;
});

startButton.addEventListener("click", async () => {
  if (running) {
    stopCamera();
    return;
  }
  await startCamera();
});

detectButton.addEventListener("click", () => {
  if (!running || !backgroundFrame) return;
  detectionActive = true;
  smoothedBox = null;
  stableFrames = 0;
  previousDetectionBox = null;
  lastValidBox = null;
  lastMarker = null;
  lastMeasurementBox = null;
  captureButton.disabled = true;
  detectButton.textContent = "Detecting…";
  detectionStatus.textContent = "Looking for object and marker";
  liveMessage.textContent = "Keep the phone still while the system frames the item";
});

captureButton.addEventListener("click", captureCurrentObject);
closeResultButton.addEventListener("click", () => { captureResult.hidden = true; });
saveToPhotos.addEventListener("click", () => shareCapturedPhoto(false));

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError("Camera requires HTTPS or localhost.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
    await video.play();
    running = true;
    backgroundFrame = null;
    smoothedBox = null;
    emptyState.hidden = true;
    cameraState.textContent = "Camera live";
    cameraState.className = "pill live";
    startButton.textContent = "Close Camera";
    detectButton.disabled = true;
    captureButton.disabled = true;
    resizeCanvases();
    detectionStatus.textContent = "Automatic setup";
    liveMessage.textContent = "Keep the scene empty and hold the phone still";
    backgroundFrame = await captureAveragedBackground(8);
    detectionActive = false;
    detectButton.disabled = false;
    detectionStatus.textContent = "Ready to detect";
    liveMessage.textContent = "Place the item and marker, then tap Detect Object";
    requestAnimationFrame(processLoop);
  } catch (error) {
    const reason = error?.name === "NotAllowedError"
      ? "Camera permission was denied. Allow camera access and try again."
      : `Unable to start camera: ${error?.message || "unknown error"}`;
    showCameraError(reason);
  }
}

function stopCamera() {
  running = false;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  backgroundFrame = null;
  smoothedBox = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  emptyState.hidden = false;
  cameraState.textContent = "Camera off";
  cameraState.className = "pill idle";
  startButton.textContent = "Open Camera";
  detectButton.disabled = true;
  captureButton.disabled = true;
  detectionStatus.textContent = "Waiting for camera";
  confidenceText.textContent = "—";
  fpsText.textContent = "—";
  markerStatus.textContent = "Not detected";
  detectionActive = false;
}

function showCameraError(message) {
  detectionStatus.textContent = "Camera unavailable";
  liveMessage.textContent = message;
  cameraState.textContent = "Camera error";
  cameraState.className = "pill idle";
}

function resizeCanvases() {
  const sourceW = video.videoWidth || 1280;
  const sourceH = video.videoHeight || 720;
  workCanvas.width = PROCESS_WIDTH;
  workCanvas.height = Math.round(PROCESS_WIDTH * sourceH / sourceW);
  overlay.width = sourceW;
  overlay.height = sourceH;
}

function drawWorkFrame() {
  workCtx.drawImage(video, 0, 0, workCanvas.width, workCanvas.height);
}

async function captureAveragedBackground(frameCount) {
  const total = workCanvas.width * workCanvas.height * 4;
  const sums = new Uint32Array(total);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    drawWorkFrame();
    const data = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height).data;
    for (let i = 0; i < total; i++) sums[i] += data[i];
    await new Promise(resolve => setTimeout(resolve, 55));
  }
  const averaged = new Uint8ClampedArray(total);
  for (let i = 0; i < total; i++) averaged[i] = Math.round(sums[i] / frameCount);
  return averaged;
}

function processLoop(now) {
  if (!running) return;
  if (now - lastProcessed >= PROCESS_INTERVAL_MS && video.readyState >= 2) {
    lastProcessed = now;
    processFrame();
    const elapsed = Math.max(1, now - previousTick);
    fpsText.textContent = `${Math.round(1000 / elapsed)} FPS`;
    previousTick = now;
  }
  requestAnimationFrame(processLoop);
}

function processFrame() {
  drawWorkFrame();
  const frame = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const width = frame.width;
  const height = frame.height;
  const threshold = Number(thresholdInput.value);
  if (!backgroundFrame) {
    drawOverlay(null, null);
    detectionStatus.textContent = "Calibration required";
    confidenceText.textContent = "—";
    markerStatus.textContent = "Not detected";
    captureButton.disabled = true;
    return;
  }

  if (!detectionActive) {
    drawOverlay(null, null);
    markerStatus.textContent = "Waiting";
    captureButton.disabled = true;
    return;
  }

  if (backgroundHasMoved(frame.data, backgroundFrame, width, height, threshold)) {
    movedBackgroundFrames += 1;
  } else {
    movedBackgroundFrames = Math.max(0, movedBackgroundFrames - 1);
  }
  if (movedBackgroundFrames >= 4) {
    smoothedBox = null;
    drawOverlay(null, null);
    detectionStatus.textContent = "Camera/background changed";
    confidenceText.textContent = "—";
    captureButton.disabled = true;
    detectButton.textContent = "Detect Object";
    detectionActive = false;
    liveMessage.textContent = "Camera position changed. Close and reopen Camera to reset";
    return;
  }

  const marker = detectReferenceMarker(frame.data, width, height);
  markerStatus.textContent = marker ? "Detected" : "Not detected";
  const mask = maskFromSavedBackground(frame.data, backgroundFrame, width, height, threshold);
  if (marker) clearMaskRegion(mask, width, height, marker, 4);

  closeSmallGaps(mask, width, height, 1);
  majorityFilter(mask, width, height, 1);
  const minimumPixels = width * height * Number(minAreaInput.value) / 1000;
  const candidate = largestCentralComponent(mask, width, height, minimumPixels);

  if (!candidate) {
    missingFrames += 1;
    if (missingFrames > 4) smoothedBox = null;
    stableFrames = 0;
    previousDetectionBox = null;
    lastValidBox = null;
    lastMeasurementBox = null;
    lastMarker = marker ? { ...marker } : null;
    captureButton.disabled = true;
    drawOverlay(null, marker);
    detectionStatus.textContent = "No clear object";
    confidenceText.textContent = "—";
    liveMessage.textContent = "No object found — keep the phone still or lower Minimum Object Size";
    return;
  }

  missingFrames = 0;
  const expanded = expandBox(candidate, width, height, 0.025);
  smoothedBox = smoothBox(smoothedBox, expanded, SMOOTHING);
  const confidence = calculateConfidence(candidate, width, height);
  const overlap = previousDetectionBox ? boxIoU(previousDetectionBox, smoothedBox) : 0;
  stableFrames = overlap > 0.82 ? Math.min(20, stableFrames + 1) : 0;
  previousDetectionBox = { ...smoothedBox };
  lastValidBox = { ...smoothedBox };
  lastMeasurementBox = { ...candidate };
  lastMarker = marker ? { ...marker } : null;
  captureButton.disabled = stableFrames < 5 || candidate.touchesEdge || !marker;
  drawOverlay(smoothedBox, marker);
  detectionStatus.textContent = "Object framed";
  confidenceText.textContent = `${Math.round(confidence * 100)}%`;
  liveMessage.textContent = candidate.touchesEdge
    ? "Move back: part of the item may be outside the picture"
    : !marker ? "Place the printed 5 cm marker beside the object"
      : stableFrames < 5 ? "Hold steady — preparing Capture" : "Object and marker ready — Capture is available";
  if (!captureButton.disabled) detectButton.textContent = "Detect New Object";
}

function boxIoU(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function detectReferenceMarker(data, width, height) {
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    mask[p] = gray < 105 ? 1 : 0;
  }
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best = null;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0, tail = 0, area = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      area++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const neighbours = [index - 1, index + 1, index - width, index + width];
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        if (Math.abs(next % width - x) > 1) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    const aspect = boxW / Math.max(1, boxH);
    const fill = area / Math.max(1, boxW * boxH);
    if (boxW < 12 || boxH < 12 || aspect < 0.80 || aspect > 1.25 || fill < 0.24 || fill > 0.72) continue;
    if (!matchesBlackWhiteMarkerPattern(data, width, height, { x:minX, y:minY, width:boxW, height:boxH })) continue;
    const score = area * (1 - Math.abs(1 - aspect));
    if (!best || score > best.score) best = { x:minX, y:minY, width:boxW, height:boxH, area, score };
  }
  return best;
}

function matchesBlackWhiteMarkerPattern(data, width, height, box) {
  const isDark = (nx, ny) => {
    const x = Math.max(0, Math.min(width - 1, Math.round(box.x + nx * (box.width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round(box.y + ny * (box.height - 1))));
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 125;
  };
  const outerDark = [[.5,.04],[.5,.96],[.04,.5],[.96,.5]].every(([x,y]) => isDark(x,y));
  const threeDark = [[.30,.30],[.70,.30],[.30,.70],[.50,.50]].every(([x,y]) => isDark(x,y));
  const openCorner = !isDark(.70,.70);
  return outerDark && threeDark && openCorner;
}

function clearMaskRegion(mask, width, height, box, margin) {
  const left = Math.max(0, box.x - margin), top = Math.max(0, box.y - margin);
  const right = Math.min(width, box.x + box.width + margin), bottom = Math.min(height, box.y + box.height + margin);
  for (let y = top; y < bottom; y++) mask.fill(0, y * width + left, y * width + right);
}

async function captureCurrentObject() {
  if (!running || !lastValidBox || !lastMeasurementBox || !lastMarker || stableFrames < 5 || video.readyState < 2) return;
  captureButton.disabled = true;
  captureButton.textContent = "Capturing…";
  const full = document.createElement("canvas");
  full.width = video.videoWidth;
  full.height = video.videoHeight;
  full.getContext("2d").drawImage(video, 0, 0, full.width, full.height);

  const sx = full.width / workCanvas.width;
  const sy = full.height / workCanvas.height;
  const x = Math.max(0, Math.floor(lastValidBox.x * sx));
  const y = Math.max(0, Math.floor(lastValidBox.y * sy));
  const w = Math.min(full.width - x, Math.ceil(lastValidBox.width * sx));
  const h = Math.min(full.height - y, Math.ceil(lastValidBox.height * sy));
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, w);
  crop.height = Math.max(1, h);
  crop.getContext("2d").drawImage(full, x, y, w, h, 0, 0, w, h);

  const previewBlob = await canvasToBlob(crop, 0.92);
  const fullBlob = await canvasToBlob(full, 0.94);
  if (captureUrl) URL.revokeObjectURL(captureUrl);
  captureUrl = URL.createObjectURL(fullBlob);
  capturedPreview.src = URL.createObjectURL(previewBlob);
  pixelSize.textContent = `${w} × ${h} px`;
  imageSize.textContent = `${full.width} × ${full.height}`;
  frameCoverage.textContent = `${((w * h) / (full.width * full.height) * 100).toFixed(1)}%`;
  const markerPixels = (lastMarker.width + lastMarker.height) / 2;
  const pixelsPerCm = markerPixels / 5;
  horizontalSize.textContent = `${(lastMeasurementBox.width / pixelsPerCm).toFixed(2)} cm`;
  verticalSize.textContent = `${(lastMeasurementBox.height / pixelsPerCm).toFixed(2)} cm`;
  referenceScale.textContent = `${pixelsPerCm.toFixed(2)} px/cm`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  capturedBlob = fullBlob;
  capturedFilename = `object-capture-${stamp}.jpg`;
  downloadCapture.href = captureUrl;
  downloadCapture.download = capturedFilename;
  captureResult.hidden = false;
  captureResult.scrollIntoView({ behavior: "smooth", block: "start" });
  captureButton.textContent = "Capture Object";
  captureButton.disabled = false;
  if (navigator.userActivation?.isActive && navigator.canShare) await shareCapturedPhoto(true);
}

async function shareCapturedPhoto(automatic) {
  if (!capturedBlob) return;
  const file = new File([capturedBlob], capturedFilename, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: "Object measurement photo" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  if (!automatic) downloadCapture.click();
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Capture failed")), "image/jpeg", quality);
  });
}

function maskFromSavedBackground(data, background, width, height, threshold) {
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const dr = data[i] - background[i];
    const dg = data[i + 1] - background[i + 1];
    const db = data[i + 2] - background[i + 2];
    const colourDistance = Math.sqrt(dr * dr + dg * dg + db * db);
    const oldLuma = 0.299 * background[i] + 0.587 * background[i + 1] + 0.114 * background[i + 2];
    const newLuma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const lumaRatio = Math.abs(newLuma - oldLuma) / Math.max(35, oldLuma);
    const oldSum = Math.max(30, background[i] + background[i + 1] + background[i + 2]);
    const newSum = Math.max(30, data[i] + data[i + 1] + data[i + 2]);
    const chromaDistance = Math.sqrt(
      Math.pow(data[i] / newSum - background[i] / oldSum, 2) +
      Math.pow(data[i + 1] / newSum - background[i + 1] / oldSum, 2) +
      Math.pow(data[i + 2] / newSum - background[i + 2] / oldSum, 2)
    ) * 255;
    const strongBrightnessChange = lumaRatio > 0.24;
    const realColourChange = chromaDistance > 9;
    mask[p] = colourDistance > threshold && (strongBrightnessChange || realColourChange) ? 1 : 0;
  }
  return mask;
}

function backgroundHasMoved(data, background, width, height, threshold) {
  let changed = 0;
  let checked = 0;
  const bandX = Math.max(3, Math.round(width * 0.045));
  const bandY = Math.max(3, Math.round(height * 0.045));
  const movementThreshold = Math.max(24, threshold * 0.8);
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      if (x > bandX && x < width - bandX && y > bandY && y < height - bandY) continue;
      const i = (y * width + x) * 4;
      const distance = Math.sqrt(
        Math.pow(data[i] - background[i], 2) +
        Math.pow(data[i + 1] - background[i + 1], 2) +
        Math.pow(data[i + 2] - background[i + 2], 2)
      );
      if (distance > movementThreshold) changed++;
      checked++;
    }
  }
  return checked > 0 && changed / checked > 0.34;
}

function majorityFilter(mask, width, height, rounds) {
  const source = new Uint8Array(mask.length);
  for (let round = 0; round < rounds; round++) {
    source.set(mask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let count = 0;
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -1; xx <= 1; xx++) count += source[(y + yy) * width + x + xx];
        }
        mask[y * width + x] = count >= 5 ? 1 : 0;
      }
    }
  }
}

function closeSmallGaps(mask, width, height, radius) {
  const source = new Uint8Array(mask);
  const dilated = new Uint8Array(mask.length);
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let found = 0;
      for (let yy = -radius; yy <= radius && !found; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          if (source[(y + yy) * width + x + xx]) { found = 1; break; }
        }
      }
      dilated[y * width + x] = found;
    }
  }
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let all = 1;
      for (let yy = -radius; yy <= radius && all; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          if (!dilated[(y + yy) * width + x + xx]) { all = 0; break; }
        }
      }
      mask[y * width + x] = all;
    }
  }
}

function largestCentralComponent(mask, width, height, minimumPixels) {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const cx = width / 2;
  const cy = height / 2;
  let best = null;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let area = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      area++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const neighbours = [index - 1, index + 1, index - width, index + width];
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }

    if (area < minimumPixels) continue;
    const boxCx = (minX + maxX) / 2;
    const boxCy = (minY + maxY) / 2;
    const centreDistance = Math.hypot((boxCx - cx) / width, (boxCy - cy) / height);
    const centralWeight = Math.max(0.25, 1 - centreDistance * 1.25);
    const score = area * centralWeight;
    const candidate = {
      x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1,
      area, score,
      touchesEdge: minX <= 2 || minY <= 2 || maxX >= width - 3 || maxY >= height - 3
    };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function expandBox(box, width, height, marginRatio) {
  const mx = Math.round(box.width * marginRatio + 2);
  const my = Math.round(box.height * marginRatio + 2);
  return {
    ...box,
    x: Math.max(0, box.x - mx),
    y: Math.max(0, box.y - my),
    width: Math.min(width, box.x + box.width + mx) - Math.max(0, box.x - mx),
    height: Math.min(height, box.y + box.height + my) - Math.max(0, box.y - my)
  };
}

function smoothBox(previous, current, alpha) {
  if (!previous) return current;
  const blend = (a, b) => a + (b - a) * alpha;
  return {
    ...current,
    x: blend(previous.x, current.x),
    y: blend(previous.y, current.y),
    width: blend(previous.width, current.width),
    height: blend(previous.height, current.height)
  };
}

function calculateConfidence(candidate, width, height) {
  const boxArea = Math.max(1, candidate.width * candidate.height);
  const fill = Math.min(1, candidate.area / boxArea);
  const size = Math.min(1, candidate.area / (width * height * 0.16));
  const edgePenalty = candidate.touchesEdge ? 0.45 : 1;
  return Math.max(0.1, Math.min(0.98, (0.42 + fill * 0.34 + size * 0.24) * edgePenalty));
}

function drawOverlay(box, marker = null) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  const sx = overlay.width / workCanvas.width;
  const sy = overlay.height / workCanvas.height;
  if (marker) {
    overlayCtx.strokeStyle = "#42d7ff";
    overlayCtx.lineWidth = Math.max(3, overlay.width / 360);
    overlayCtx.setLineDash([12, 8]);
    overlayCtx.strokeRect(marker.x * sx, marker.y * sy, marker.width * sx, marker.height * sy);
    overlayCtx.setLineDash([]);
    overlayCtx.fillStyle = "#42d7ff";
    overlayCtx.font = `700 ${Math.max(16, overlay.width / 44)}px system-ui`;
    overlayCtx.fillText("5 CM REFERENCE", marker.x * sx, Math.max(18, marker.y * sy - 7));
  }
  if (!box) return;
  const x = box.x * sx;
  const y = box.y * sy;
  const w = box.width * sx;
  const h = box.height * sy;

  overlayCtx.strokeStyle = box.touchesEdge ? "#ffba52" : "#54e38e";
  overlayCtx.lineWidth = Math.max(4, overlay.width / 280);
  overlayCtx.shadowColor = "rgba(0,0,0,.65)";
  overlayCtx.shadowBlur = 8;
  roundedRect(overlayCtx, x, y, w, h, Math.min(24, w * 0.08));
  overlayCtx.stroke();
  overlayCtx.shadowBlur = 0;

  const label = box.touchesEdge ? "ITEM MAY BE CUT OFF" : "OBJECT";
  overlayCtx.font = `700 ${Math.max(18, overlay.width / 38)}px system-ui`;
  const textWidth = overlayCtx.measureText(label).width;
  const labelH = Math.max(34, overlay.width / 23);
  overlayCtx.fillStyle = box.touchesEdge ? "#ffba52" : "#54e38e";
  overlayCtx.fillRect(x, Math.max(0, y - labelH), textWidth + 22, labelH);
  overlayCtx.fillStyle = "#07120c";
  overlayCtx.fillText(label, x + 11, Math.max(labelH * .72, y - labelH * .28));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

window.addEventListener("resize", () => {
  if (running) resizeCanvases();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) stopCamera();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=0.5.0")
      .then(registration => registration.update())
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("live-object-frame-reloaded") === "0.5.0") return;
      sessionStorage.setItem("live-object-frame-reloaded", "0.5.0");
      window.location.reload();
    });
  });
}
