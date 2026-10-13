"use strict";

const video = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const overlayCtx = overlay.getContext("2d");
const workCanvas = document.querySelector("#processingCanvas");
const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
const startButton = document.querySelector("#startButton");
const calibrateButton = document.querySelector("#calibrateButton");
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
const analysisStatus = document.querySelector("#analysisStatus");
const analysisReason = document.querySelector("#analysisReason");
const homePage = document.querySelector("#homePage");
const measurementPage = document.querySelector("#measurementPage");
const startMeasurementButton = document.querySelector("#startMeasurementButton");
const homeHistoryButton = document.querySelector("#homeHistoryButton");
const homeHistoryCount = document.querySelector("#homeHistoryCount");
const homeButton = document.querySelector("#homeButton");
const frameEditorStage = document.querySelector("#frameEditorStage");
const frameEditor = document.querySelector("#frameEditor");
const frameEditorCtx = frameEditor.getContext("2d");
const editorHint = document.querySelector("#editorHint");
const useSystemFrameButton = document.querySelector("#useSystemFrame");
const manualFrameButton = document.querySelector("#manualFrame");
const undoFrameButton = document.querySelector("#undoFrame");
const redoFrameButton = document.querySelector("#redoFrame");
const resetFrameButton = document.querySelector("#resetFrame");
const confirmFrameButton = document.querySelector("#confirmFrame");
const saveCurrentRecordButton = document.querySelector("#saveCurrentRecordButton");
const nextItemButton = document.querySelector("#nextItemButton");
const barcodeDialog = document.querySelector("#barcodeDialog");
const barcodeForm = document.querySelector("#barcodeForm");
const barcodeInput = document.querySelector("#barcodeInput");
const barcodeMessage = document.querySelector("#barcodeMessage");
const barcodeVideo = document.querySelector("#barcodeVideo");
const scanBarcodeButton = document.querySelector("#scanBarcodeButton");
const stopBarcodeScanButton = document.querySelector("#stopBarcodeScanButton");
const saveRecordDialog = document.querySelector("#saveRecordDialog");
const saveRecordSummary = document.querySelector("#saveRecordSummary");
const saveRecordButton = document.querySelector("#saveRecordButton");
const skipSaveButton = document.querySelector("#skipSaveButton");
const cancelNextItemButton = document.querySelector("#cancelNextItemButton");
const duplicateBarcodeDialog = document.querySelector("#duplicateBarcodeDialog");
const duplicateBarcodeMessage = document.querySelector("#duplicateBarcodeMessage");
const replaceDuplicateButton = document.querySelector("#replaceDuplicateButton");
const keepDuplicateButton = document.querySelector("#keepDuplicateButton");
const cancelDuplicateButton = document.querySelector("#cancelDuplicateButton");
const historyButton = document.querySelector("#historyButton");
const historyCount = document.querySelector("#historyCount");
const historyDialog = document.querySelector("#historyDialog");
const closeHistoryButton = document.querySelector("#closeHistoryButton");
const historyTableBody = document.querySelector("#historyTableBody");
const emptyHistory = document.querySelector("#emptyHistory");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const exportImagesButton = document.querySelector("#exportImagesButton");
const exportHistoryButton = document.querySelector("#exportHistoryButton");
const exportNotice = document.querySelector("#exportNotice");
const exportNoticeTitle = document.querySelector("#exportNoticeTitle");
const exportNoticeFilename = document.querySelector("#exportNoticeFilename");
const exportFileLink = document.querySelector("#exportFileLink");
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
let stableFrames = 0;
let previousDetectionBox = null;
let lastValidBox = null;
let captureUrl = null;
let capturedFilename = "object-capture.jpg";
let detectionActive = false;
let liveMarker = null;
let markerMissingFrames = 0;
let capturedFullCanvas = null;
let capturedMarker = null;
let systemFrame = null;
let editableFrame = null;
let frameHistory = [];
let frameHistoryIndex = -1;
let manualFrameEnabled = false;
let frameGesture = null;
let currentBarcode = "";
let currentMeasurement = null;
let currentItemImageBlob = null;
let pendingRecordAction = null;
let activeExportUrl = null;
let barcodeStream = null;
let barcodeScanRunning = false;
let pendingBarcode = "";
let measurementRecords = loadMeasurementRecords();

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

calibrateButton.addEventListener("click", async () => {
  if (!running || video.readyState < 2) return;
  calibrateButton.disabled = true;
  detectButton.disabled = true;
  captureButton.disabled = true;
  detectionActive = false;
  calibrateButton.textContent = "Saving Background…";
  detectionStatus.textContent = "Capturing empty background";
  liveMessage.textContent = "Keep the scene empty and hold the phone still";
  backgroundFrame = await captureAveragedBackground(10);
  smoothedBox = null;
  stableFrames = 0;
  previousDetectionBox = null;
  lastValidBox = null;
  liveMarker = null;
  markerMissingFrames = 0;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  detectionStatus.textContent = "Empty background saved";
  liveMessage.textContent = "Place the item and marker, then tap Detect Object";
  markerStatus.textContent = "Waiting for Detect Object";
  calibrateButton.textContent = "Set Empty Background Again";
  calibrateButton.disabled = false;
  detectButton.disabled = false;
});

detectButton.addEventListener("click", () => {
  if (currentMeasurement) {
    if (currentMeasurement.saved) prepareForNextBarcode();
    else requestRecordDecision("detect");
    return;
  }
  beginDetection();
});

function beginDetection() {
  if (!running || !backgroundFrame) return;
  detectionActive = true;
  smoothedBox = null;
  stableFrames = 0;
  previousDetectionBox = null;
  lastValidBox = null;
  liveMarker = null;
  markerMissingFrames = 0;
  captureButton.disabled = false;
  detectButton.textContent = "Detecting…";
  detectionStatus.textContent = "Looking for item and marker";
  liveMessage.textContent = "Green frame = item; cyan frame = 5 cm marker";
}

captureButton.addEventListener("click", captureCurrentObject);
closeResultButton.addEventListener("click", () => { captureResult.hidden = true; });
useSystemFrameButton.addEventListener("click", useDetectedFrame);
manualFrameButton.addEventListener("click", enableManualFrame);
undoFrameButton.addEventListener("click", undoFrameEdit);
redoFrameButton.addEventListener("click", redoFrameEdit);
resetFrameButton.addEventListener("click", resetFrameEdit);
confirmFrameButton.addEventListener("click", confirmFrameAndMeasure);
frameEditor.addEventListener("pointerdown", beginFrameEdit);
frameEditor.addEventListener("pointermove", moveFrameEdit);
frameEditor.addEventListener("pointerup", endFrameEdit);
frameEditor.addEventListener("pointercancel", endFrameEdit);
barcodeForm.addEventListener("submit", acceptBarcode);
startMeasurementButton.addEventListener("click", openBarcodeDialog);
homeHistoryButton.addEventListener("click", openHistory);
homeButton.addEventListener("click", () => requestRecordDecision("home"));
scanBarcodeButton.addEventListener("click", startBarcodeScan);
stopBarcodeScanButton.addEventListener("click", stopBarcodeScan);
saveCurrentRecordButton.addEventListener("click", saveCurrentRecordWithoutLeaving);
nextItemButton.addEventListener("click", () => requestRecordDecision("next"));
saveRecordButton.addEventListener("click", () => finishRecordDecision(true));
skipSaveButton.addEventListener("click", () => finishRecordDecision(false));
cancelNextItemButton.addEventListener("click", () => { pendingRecordAction = null; saveRecordDialog.close(); });
historyButton.addEventListener("click", () => requestHistory());
closeHistoryButton.addEventListener("click", () => historyDialog.close());
clearHistoryButton.addEventListener("click", clearMeasurementHistory);
exportHistoryButton.addEventListener("click", exportMeasurementHistory);
exportImagesButton.addEventListener("click", exportItemImages);
replaceDuplicateButton.addEventListener("click", () => resolveDuplicateBarcode("replace"));
keepDuplicateButton.addEventListener("click", () => resolveDuplicateBarcode("duplicate"));
cancelDuplicateButton.addEventListener("click", () => resolveDuplicateBarcode("cancel"));

updateHistoryCount();

barcodeDialog.addEventListener("cancel", event => event.preventDefault());

function openBarcodeDialog() {
  stopBarcodeScan();
  barcodeInput.value = "";
  barcodeMessage.textContent = "Key in the barcode or scan it using the phone camera.";
  if (!barcodeDialog.open) barcodeDialog.showModal();
  setTimeout(() => barcodeInput.focus(), 80);
}

function acceptBarcode(event) {
  event.preventDefault();
  const value = barcodeInput.value.trim();
  if (!value) {
    barcodeMessage.textContent = "Barcode is required before measuring the product.";
    return;
  }
  const duplicateCount = measurementRecords.filter(record => record.barcode === value).length;
  if (duplicateCount) {
    pendingBarcode = value;
    duplicateBarcodeMessage.textContent = `${value} already has ${duplicateCount} saved record${duplicateCount === 1 ? "" : "s"}. Replace removes the old record(s); Keep Duplicate adds another.`;
    barcodeDialog.close();
    duplicateBarcodeDialog.showModal();
    return;
  }
  useBarcode(value);
}

function useBarcode(value) {
  currentBarcode = value;
  currentMeasurement = null;
  currentItemImageBlob = null;
  stopBarcodeScan();
  if (barcodeDialog.open) barcodeDialog.close();
  homePage.hidden = true;
  measurementPage.hidden = false;
  captureResult.hidden = true;
  nextItemButton.hidden = true;
  saveCurrentRecordButton.hidden = true;
  smoothedBox = null;
  lastValidBox = null;
  detectionActive = false;
  if (running && backgroundFrame) {
    detectButton.disabled = false;
    detectionStatus.textContent = "Ready for next item";
    liveMessage.textContent = `Barcode ${currentBarcode}: place the product and marker, then tap Detect Object`;
  } else {
    detectionStatus.textContent = "Barcode ready";
    liveMessage.textContent = `Barcode ${currentBarcode}: tap Open Camera to begin`;
  }
}

async function resolveDuplicateBarcode(action) {
  duplicateBarcodeDialog.close();
  if (action === "cancel") {
    pendingBarcode = "";
    openBarcodeDialog();
    return;
  }
  if (action === "replace") {
    const removed = measurementRecords.filter(record => record.barcode === pendingBarcode);
    await Promise.allSettled(removed.filter(record => record.imageId).map(record => deleteItemImage(record.imageId)));
    measurementRecords = measurementRecords.filter(record => record.barcode !== pendingBarcode);
    localStorage.setItem("object-measurement-records-v1", JSON.stringify(measurementRecords));
    updateHistoryCount();
  }
  const value = pendingBarcode;
  pendingBarcode = "";
  useBarcode(value);
}

function showHome() {
  stopCamera();
  captureResult.hidden = true;
  measurementPage.hidden = true;
  homePage.hidden = false;
}

async function startBarcodeScan() {
  if (!("BarcodeDetector" in window)) {
    barcodeMessage.textContent = "Barcode scanning is not supported by this browser. Please key in the barcode.";
    return;
  }
  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    const detector = formats.length ? new BarcodeDetector({ formats }) : new BarcodeDetector();
    if (running && stream) {
      barcodeVideo.srcObject = stream;
    } else {
      barcodeStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });
      barcodeVideo.srcObject = barcodeStream;
    }
    await barcodeVideo.play();
    barcodeVideo.hidden = false;
    scanBarcodeButton.hidden = true;
    stopBarcodeScanButton.hidden = false;
    barcodeScanRunning = true;
    barcodeMessage.textContent = "Point the camera at one barcode and hold still.";
    const scan = async () => {
      if (!barcodeScanRunning) return;
      try {
        const results = await detector.detect(barcodeVideo);
        if (results.length) {
          barcodeInput.value = results[0].rawValue;
          barcodeMessage.textContent = `Barcode detected: ${results[0].rawValue}`;
          stopBarcodeScan();
          return;
        }
      } catch (_) {}
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch (error) {
    stopBarcodeScan();
    barcodeMessage.textContent = `Unable to scan barcode: ${error?.message || "camera unavailable"}. Please key it in.`;
  }
}

function stopBarcodeScan() {
  barcodeScanRunning = false;
  if (barcodeStream) barcodeStream.getTracks().forEach(track => track.stop());
  barcodeStream = null;
  barcodeVideo.pause();
  barcodeVideo.srcObject = null;
  barcodeVideo.hidden = true;
  scanBarcodeButton.hidden = false;
  stopBarcodeScanButton.hidden = true;
}

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
    calibrateButton.disabled = false;
    detectButton.disabled = true;
    captureButton.disabled = true;
    resizeCanvases();
    detectionActive = false;
    detectionStatus.textContent = "Empty background required";
    markerStatus.textContent = "Waiting for background";
    liveMessage.textContent = "Remove the item and marker, then tap Set Empty Background";
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
  calibrateButton.disabled = true;
  calibrateButton.textContent = "Set Empty Background";
  detectButton.disabled = true;
  captureButton.disabled = true;
  detectionStatus.textContent = "Waiting for camera";
  confidenceText.textContent = "—";
  fpsText.textContent = "—";
  markerStatus.textContent = "Checked after Capture";
  detectionActive = false;
  liveMarker = null;
  markerMissingFrames = 0;
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
    markerStatus.textContent = "Waiting for background";
    captureButton.disabled = true;
    return;
  }

  if (!detectionActive) {
    drawOverlay(null, null);
    markerStatus.textContent = "Waiting for Detect Object";
    captureButton.disabled = true;
    return;
  }

  const alignment = estimateBackgroundOffset(frame.data, backgroundFrame, width, height, 6);
  const detectedMarker = detectReferenceMarker(frame.data, width, height);
  if (detectedMarker) {
    liveMarker = { ...detectedMarker };
    markerMissingFrames = 0;
  } else {
    markerMissingFrames += 1;
    if (markerMissingFrames > 10) liveMarker = null;
  }
  markerStatus.textContent = liveMarker ? "Detected" : "Not detected";
  const mask = maskFromSavedBackground(
    frame.data, backgroundFrame, width, height, threshold, alignment.dx, alignment.dy
  );
  if (liveMarker) {
    const margin = Math.max(4, Math.round(Math.max(liveMarker.width, liveMarker.height) * 0.25));
    clearMaskRegion(mask, width, height, liveMarker, margin);
  }

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
    captureButton.disabled = false;
    drawOverlay(null, liveMarker);
    detectionStatus.textContent = "No clear object";
    confidenceText.textContent = "—";
    liveMessage.textContent = "Live item frame not found — you may still Capture for photo analysis";
    return;
  }

  missingFrames = 0;
  const expanded = expandBox(candidate, width, height, 0.025);
  smoothedBox = smoothBox(smoothedBox, expanded, SMOOTHING);
  const confidence = calculateConfidence(candidate, width, height);
  const overlap = previousDetectionBox ? boxIoU(previousDetectionBox, smoothedBox) : 0;
  stableFrames = overlap > 0.72 ? Math.min(20, stableFrames + 1) : 0;
  previousDetectionBox = { ...smoothedBox };
  lastValidBox = { ...smoothedBox };
  captureButton.disabled = false;
  drawOverlay(smoothedBox, liveMarker);
  detectionStatus.textContent = "Item framed";
  confidenceText.textContent = `${Math.round(confidence * 100)}%`;
  liveMessage.textContent = candidate.touchesEdge
    ? "Move back: part of the item may be outside the picture"
    : stableFrames < 3 ? "Hold steady — preparing Capture" : "Item ready — make sure the marker is also visible, then Capture";
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
    if (boxW < 12 || boxH < 12 || aspect < 0.70 || aspect > 1.40 || fill < 0.10 || fill > 0.85) continue;
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
  if (!running || !detectionActive || video.readyState < 2) return;
  captureButton.disabled = true;
  currentMeasurement = null;
  currentItemImageBlob = null;
  nextItemButton.hidden = true;
  saveCurrentRecordButton.hidden = true;
  captureButton.setAttribute("aria-label", "Capturing");
  captureButton.title = "Capturing";
  const full = document.createElement("canvas");
  full.width = video.videoWidth;
  full.height = video.videoHeight;
  const fullCtx = full.getContext("2d", { willReadFrequently: true });
  fullCtx.drawImage(video, 0, 0, full.width, full.height);

  const fullFrame = fullCtx.getImageData(0, 0, full.width, full.height);
  capturedMarker = detectReferenceMarker(fullFrame.data, full.width, full.height);
  if (!capturedMarker && liveMarker) {
    const liveScaleX = full.width / workCanvas.width;
    const liveScaleY = full.height / workCanvas.height;
    capturedMarker = {
      x: liveMarker.x * liveScaleX,
      y: liveMarker.y * liveScaleY,
      width: liveMarker.width * liveScaleX,
      height: liveMarker.height * liveScaleY
    };
  }
  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = workCanvas.width;
  analysisCanvas.height = workCanvas.height;
  const analysisCtx = analysisCanvas.getContext("2d", { willReadFrequently: true });
  analysisCtx.drawImage(full, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const smallFrame = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
  const alignment = estimateBackgroundOffset(
    smallFrame.data, backgroundFrame, analysisCanvas.width, analysisCanvas.height, 6
  );
  const capturedMask = maskFromSavedBackground(
    smallFrame.data, backgroundFrame, analysisCanvas.width, analysisCanvas.height,
    Number(thresholdInput.value), alignment.dx, alignment.dy
  );
  if (capturedMarker) {
    const markerOnAnalysis = {
      x: capturedMarker.x * analysisCanvas.width / full.width,
      y: capturedMarker.y * analysisCanvas.height / full.height,
      width: capturedMarker.width * analysisCanvas.width / full.width,
      height: capturedMarker.height * analysisCanvas.height / full.height
    };
    const markerPaperMargin = Math.max(5, Math.round(Math.max(markerOnAnalysis.width, markerOnAnalysis.height) * 0.25));
    clearMaskRegion(
      capturedMask, analysisCanvas.width, analysisCanvas.height, markerOnAnalysis, markerPaperMargin
    );
  }
  closeSmallGaps(capturedMask, analysisCanvas.width, analysisCanvas.height, 1);
  majorityFilter(capturedMask, analysisCanvas.width, analysisCanvas.height, 1);
  const minimumPixels = analysisCanvas.width * analysisCanvas.height * Number(minAreaInput.value) / 1000;
  const capturedItem = largestCentralComponent(
    capturedMask, analysisCanvas.width, analysisCanvas.height, minimumPixels
  );

  const sx = full.width / analysisCanvas.width;
  const sy = full.height / analysisCanvas.height;
  const detectedFrame = capturedItem
    ? expandBox(capturedItem, analysisCanvas.width, analysisCanvas.height, 0.02)
    : lastValidBox || {
      x: analysisCanvas.width * 0.2, y: analysisCanvas.height * 0.2,
      width: analysisCanvas.width * 0.6, height: analysisCanvas.height * 0.6
    };
  systemFrame = normaliseFrame({
    x: detectedFrame.x * sx, y: detectedFrame.y * sy,
    width: detectedFrame.width * sx, height: detectedFrame.height * sy
  }, full.width, full.height);
  editableFrame = { ...systemFrame };
  capturedFullCanvas = full;
  frameEditor.width = full.width;
  frameEditor.height = full.height;
  frameHistory = [{ ...editableFrame }];
  frameHistoryIndex = 0;
  manualFrameEnabled = false;
  frameEditorStage.hidden = false;
  capturedPreview.hidden = true;
  useSystemFrameButton.classList.add("active");
  manualFrameButton.classList.remove("active");
  updateFrameHistoryButtons();
  renderFrameEditor();

  pixelSize.textContent = `${Math.round(editableFrame.width)} × ${Math.round(editableFrame.height)} px`;
  imageSize.textContent = `${full.width} × ${full.height}`;
  frameCoverage.textContent = `${((editableFrame.width * editableFrame.height) / (full.width * full.height) * 100).toFixed(1)}%`;
  markerStatus.textContent = capturedMarker ? "Detected" : "Not detected";
  analysisStatus.textContent = "FRAME REVIEW";
  analysisReason.textContent = capturedItem ? "Review the suggested frame" : "System frame unavailable — adjust the manual frame";
  horizontalSize.textContent = "Pending frame confirmation";
  verticalSize.textContent = "Pending frame confirmation";
  referenceScale.textContent = capturedMarker
    ? `${(((capturedMarker.width + capturedMarker.height) / 2) / 5).toFixed(2)} px/cm`
    : "—";
  captureResult.hidden = false;
  captureResult.scrollIntoView({ behavior: "smooth", block: "start" });
  captureButton.setAttribute("aria-label", "Capture object");
  captureButton.title = "Capture object";
  captureButton.disabled = false;
}

function normaliseFrame(frame, width, height) {
  const minimum = Math.max(24, Math.min(width, height) * 0.04);
  const x = Math.max(0, Math.min(width - minimum, frame.x));
  const y = Math.max(0, Math.min(height - minimum, frame.y));
  return {
    x,
    y,
    width: Math.max(minimum, Math.min(width - x, frame.width)),
    height: Math.max(minimum, Math.min(height - y, frame.height))
  };
}

function useDetectedFrame() {
  if (!systemFrame) return;
  editableFrame = { ...systemFrame };
  manualFrameEnabled = false;
  useSystemFrameButton.classList.add("active");
  manualFrameButton.classList.remove("active");
  editorHint.textContent = "System frame selected. Confirm it, or choose Manual Frame to adjust.";
  pushFrameHistory();
  renderFrameEditor();
}

function enableManualFrame() {
  if (!editableFrame) return;
  manualFrameEnabled = true;
  manualFrameButton.classList.add("active");
  useSystemFrameButton.classList.remove("active");
  editorHint.textContent = "Drag inside the frame to move it. Drag any square handle to resize.";
  renderFrameEditor();
}

function resetFrameEdit() {
  if (!systemFrame) return;
  editableFrame = { ...systemFrame };
  manualFrameEnabled = true;
  manualFrameButton.classList.add("active");
  useSystemFrameButton.classList.remove("active");
  pushFrameHistory();
  renderFrameEditor();
}

function pushFrameHistory() {
  if (!editableFrame) return;
  const current = frameHistory[frameHistoryIndex];
  if (current && ["x", "y", "width", "height"].every(key => Math.abs(current[key] - editableFrame[key]) < 0.5)) return;
  frameHistory = frameHistory.slice(0, frameHistoryIndex + 1);
  frameHistory.push({ ...editableFrame });
  frameHistoryIndex = frameHistory.length - 1;
  updateFrameHistoryButtons();
}

function undoFrameEdit() {
  if (frameHistoryIndex <= 0) return;
  frameHistoryIndex--;
  editableFrame = { ...frameHistory[frameHistoryIndex] };
  updateFrameHistoryButtons();
  renderFrameEditor();
}

function redoFrameEdit() {
  if (frameHistoryIndex >= frameHistory.length - 1) return;
  frameHistoryIndex++;
  editableFrame = { ...frameHistory[frameHistoryIndex] };
  updateFrameHistoryButtons();
  renderFrameEditor();
}

function updateFrameHistoryButtons() {
  undoFrameButton.disabled = frameHistoryIndex <= 0;
  redoFrameButton.disabled = frameHistoryIndex < 0 || frameHistoryIndex >= frameHistory.length - 1;
}

function editorPoint(event) {
  const rect = frameEditor.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * frameEditor.width / rect.width,
    y: (event.clientY - rect.top) * frameEditor.height / rect.height
  };
}

function frameHandles(frame) {
  const x1 = frame.x, x2 = frame.x + frame.width / 2, x3 = frame.x + frame.width;
  const y1 = frame.y, y2 = frame.y + frame.height / 2, y3 = frame.y + frame.height;
  return [
    { name: "nw", x: x1, y: y1 }, { name: "n", x: x2, y: y1 }, { name: "ne", x: x3, y: y1 },
    { name: "e", x: x3, y: y2 }, { name: "se", x: x3, y: y3 }, { name: "s", x: x2, y: y3 },
    { name: "sw", x: x1, y: y3 }, { name: "w", x: x1, y: y2 }
  ];
}

function beginFrameEdit(event) {
  if (!manualFrameEnabled || !editableFrame) return;
  const point = editorPoint(event);
  const rect = frameEditor.getBoundingClientRect();
  const tolerance = 22 * frameEditor.width / rect.width;
  const handle = frameHandles(editableFrame).find(item => Math.hypot(point.x - item.x, point.y - item.y) <= tolerance);
  const inside = point.x >= editableFrame.x && point.x <= editableFrame.x + editableFrame.width &&
    point.y >= editableFrame.y && point.y <= editableFrame.y + editableFrame.height;
  if (!handle && !inside) return;
  frameEditor.setPointerCapture(event.pointerId);
  frameGesture = { type: handle?.name || "move", start: point, frame: { ...editableFrame } };
}

function moveFrameEdit(event) {
  if (!frameGesture || !editableFrame) return;
  const point = editorPoint(event);
  const dx = point.x - frameGesture.start.x;
  const dy = point.y - frameGesture.start.y;
  const start = frameGesture.frame;
  let left = start.x, top = start.y, right = start.x + start.width, bottom = start.y + start.height;
  if (frameGesture.type === "move") {
    left += dx; right += dx; top += dy; bottom += dy;
  } else {
    if (frameGesture.type.includes("w")) left += dx;
    if (frameGesture.type.includes("e")) right += dx;
    if (frameGesture.type.includes("n")) top += dy;
    if (frameGesture.type.includes("s")) bottom += dy;
  }
  const minimum = Math.max(24, Math.min(frameEditor.width, frameEditor.height) * 0.04);
  if (right - left < minimum) frameGesture.type.includes("w") ? left = right - minimum : right = left + minimum;
  if (bottom - top < minimum) frameGesture.type.includes("n") ? top = bottom - minimum : bottom = top + minimum;
  if (frameGesture.type === "move") {
    const width = right - left, height = bottom - top;
    left = Math.max(0, Math.min(frameEditor.width - width, left));
    top = Math.max(0, Math.min(frameEditor.height - height, top));
    right = left + width; bottom = top + height;
  }
  left = Math.max(0, left); top = Math.max(0, top);
  right = Math.min(frameEditor.width, right); bottom = Math.min(frameEditor.height, bottom);
  editableFrame = { x: left, y: top, width: right - left, height: bottom - top };
  renderFrameEditor();
}

function endFrameEdit(event) {
  if (!frameGesture) return;
  if (frameEditor.hasPointerCapture(event.pointerId)) frameEditor.releasePointerCapture(event.pointerId);
  frameGesture = null;
  pushFrameHistory();
}

function renderFrameEditor() {
  if (!capturedFullCanvas || !editableFrame) return;
  frameEditorCtx.clearRect(0, 0, frameEditor.width, frameEditor.height);
  frameEditorCtx.drawImage(capturedFullCanvas, 0, 0);
  const lineWidth = Math.max(4, frameEditor.width / 300);
  frameEditorCtx.strokeStyle = "#54e38e";
  frameEditorCtx.lineWidth = lineWidth;
  frameEditorCtx.strokeRect(editableFrame.x, editableFrame.y, editableFrame.width, editableFrame.height);
  if (manualFrameEnabled) {
    const size = Math.max(24, frameEditor.width / 28);
    frameEditorCtx.fillStyle = "#ffffff";
    frameEditorCtx.strokeStyle = "#0a7d43";
    frameEditorCtx.lineWidth = Math.max(2, lineWidth / 2);
    for (const handle of frameHandles(editableFrame)) {
      frameEditorCtx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
      frameEditorCtx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
    }
  }
  pixelSize.textContent = `${Math.round(editableFrame.width)} × ${Math.round(editableFrame.height)} px`;
  frameCoverage.textContent = `${((editableFrame.width * editableFrame.height) / (frameEditor.width * frameEditor.height) * 100).toFixed(1)}%`;
}

async function confirmFrameAndMeasure() {
  if (!capturedFullCanvas || !editableFrame) return;
  if (!capturedMarker) {
    analysisStatus.textContent = "REVIEW REQUIRED";
    analysisReason.textContent = "5 cm reference marker was not detected; measurement was not guessed";
    return;
  }
  const pixelsPerCm = ((capturedMarker.width + capturedMarker.height) / 2) / 5;
  const horizontalCm = editableFrame.width / pixelsPerCm;
  const verticalCm = editableFrame.height / pixelsPerCm;
  const date = new Date().toISOString().slice(0, 10);
  const safeBarcode = currentBarcode.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 48) || "unknown";
  const itemCanvas = document.createElement("canvas");
  itemCanvas.width = Math.max(1, Math.round(editableFrame.width));
  itemCanvas.height = Math.max(1, Math.round(editableFrame.height));
  itemCanvas.getContext("2d").drawImage(
    capturedFullCanvas,
    editableFrame.x, editableFrame.y, editableFrame.width, editableFrame.height,
    0, 0, itemCanvas.width, itemCanvas.height
  );
  currentItemImageBlob = await canvasToBlob(itemCanvas, 0.94);
  const measurementFilename = `${safeBarcode}_H-${horizontalCm.toFixed(2)}cm_V-${verticalCm.toFixed(2)}cm_${date}.jpg`;
  const itemImageFilename = measurementFilename;
  const output = document.createElement("canvas");
  output.width = capturedFullCanvas.width;
  output.height = capturedFullCanvas.height;
  const ctx = output.getContext("2d");
  ctx.drawImage(capturedFullCanvas, 0, 0);
  const lineWidth = Math.max(6, output.width / 220);
  ctx.strokeStyle = "#36e37e";
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(editableFrame.x, editableFrame.y, editableFrame.width, editableFrame.height);
  const fontSize = Math.max(30, output.width / 32);
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  const lines = [
    `Barcode: ${currentBarcode}`,
    `Horizontal: ${horizontalCm.toFixed(2)} cm`,
    `Vertical: ${verticalCm.toFixed(2)} cm`
  ];
  const padding = fontSize * 0.45;
  const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  const labelHeight = fontSize * 3.65;
  const labelX = Math.max(0, Math.min(output.width - textWidth - padding * 2, editableFrame.x));
  const preferredY = editableFrame.y - labelHeight - lineWidth;
  const labelY = preferredY >= 0 ? preferredY : Math.min(output.height - labelHeight, editableFrame.y + editableFrame.height + lineWidth);
  ctx.fillStyle = "rgba(0, 0, 0, .78)";
  ctx.fillRect(labelX, labelY, textWidth + padding * 2, labelHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(lines[0], labelX + padding, labelY + fontSize * 1.05);
  ctx.fillText(lines[1], labelX + padding, labelY + fontSize * 2.15);
  ctx.fillText(lines[2], labelX + padding, labelY + fontSize * 3.25);

  const capturedBlob = await canvasToBlob(output, 0.94);
  if (captureUrl) URL.revokeObjectURL(captureUrl);
  captureUrl = URL.createObjectURL(capturedBlob);
  capturedFilename = measurementFilename;
  capturedPreview.src = captureUrl;
  capturedPreview.hidden = false;
  frameEditorStage.hidden = true;
  horizontalSize.textContent = `${horizontalCm.toFixed(2)} cm`;
  verticalSize.textContent = `${verticalCm.toFixed(2)} cm`;
  referenceScale.textContent = `${pixelsPerCm.toFixed(2)} px/cm`;
  analysisStatus.textContent = "MEASURED";
  analysisReason.textContent = manualFrameEnabled ? "Manual frame confirmed" : "System frame confirmed";
  currentMeasurement = {
    barcode: currentBarcode,
    horizontalCm: Number(horizontalCm.toFixed(2)),
    verticalCm: Number(verticalCm.toFixed(2)),
    frameType: manualFrameEnabled ? "Manual" : "System",
    measuredAt: new Date().toISOString(),
    imageFilename: capturedFilename,
    itemImageFilename,
    saved: false
  };
  saveCurrentRecordButton.hidden = false;
  saveCurrentRecordButton.disabled = false;
  saveCurrentRecordButton.textContent = "Save Current Record";
  nextItemButton.hidden = false;
  downloadBlob(capturedBlob, capturedFilename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function requestRecordDecision(action) {
  if (!currentMeasurement) {
    if (action === "history") openHistory();
    else if (action === "home") showHome();
    else prepareForNextBarcode();
    return;
  }
  if (currentMeasurement.saved) {
    if (action === "history") openHistory();
    else if (action === "home") showHome();
    else prepareForNextBarcode();
    return;
  }
  pendingRecordAction = action;
  saveRecordSummary.textContent = `${currentMeasurement.barcode} — Horizontal ${currentMeasurement.horizontalCm.toFixed(2)} cm × Vertical ${currentMeasurement.verticalCm.toFixed(2)} cm`;
  saveRecordDialog.showModal();
}

function requestHistory() {
  requestRecordDecision("history");
}

async function saveCurrentRecordWithoutLeaving() {
  await persistCurrentMeasurement();
}

async function finishRecordDecision(shouldSave) {
  if (shouldSave) await persistCurrentMeasurement();
  const action = pendingRecordAction;
  pendingRecordAction = null;
  saveRecordDialog.close();
  if (action === "history") {
    openHistory();
    return;
  }
  if (action === "home") {
    showHome();
    return;
  }
  prepareForNextBarcode();
}

async function persistCurrentMeasurement() {
  if (!currentMeasurement || currentMeasurement.saved) return;
  const imageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let imageSaved = false;
  if (currentItemImageBlob) {
    try {
      await saveItemImage(imageId, currentMeasurement.itemImageFilename, currentItemImageBlob);
      imageSaved = true;
    } catch (_) {
      imageSaved = false;
    }
  }
  currentMeasurement.imageId = imageSaved ? imageId : "";
  currentMeasurement.saved = true;
  measurementRecords.push({ ...currentMeasurement });
  localStorage.setItem("object-measurement-records-v1", JSON.stringify(measurementRecords));
  updateHistoryCount();
  saveCurrentRecordButton.disabled = true;
  saveCurrentRecordButton.textContent = "Record Saved";
  analysisReason.textContent = imageSaved
    ? "Measurement and item-only image saved to History"
    : "Measurement saved; item image storage was unavailable";
}

function prepareForNextBarcode() {
  currentMeasurement = null;
  currentItemImageBlob = null;
  currentBarcode = "";
  captureResult.hidden = true;
  nextItemButton.hidden = true;
  saveCurrentRecordButton.hidden = true;
  detectionActive = false;
  smoothedBox = null;
  lastValidBox = null;
  liveMarker = null;
  markerMissingFrames = 0;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  captureButton.disabled = true;
  if (running && backgroundFrame) {
    detectionStatus.textContent = "Waiting for next barcode";
    liveMessage.textContent = "Remove the current product, then enter the next barcode";
  }
  openBarcodeDialog();
}

function loadMeasurementRecords() {
  try {
    const value = JSON.parse(localStorage.getItem("object-measurement-records-v1") || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function updateHistoryCount() {
  historyCount.textContent = String(measurementRecords.length);
  homeHistoryCount.textContent = String(measurementRecords.length);
}

function openHistory() {
  renderHistory();
  historyDialog.showModal();
}

function renderHistory() {
  historyTableBody.replaceChildren();
  measurementRecords.forEach((record, index) => {
    const row = document.createElement("tr");
    const numberCell = document.createElement("td");
    numberCell.textContent = index + 1;
    row.appendChild(numberCell);
    const imageCell = document.createElement("td");
    imageCell.textContent = record.imageId ? "Loading…" : "—";
    row.appendChild(imageCell);
    if (record.imageId) {
      getItemImage(record.imageId).then(imageRecord => {
        if (!imageRecord?.blob || !imageCell.isConnected) { imageCell.textContent = "Unavailable"; return; }
        const url = URL.createObjectURL(imageRecord.blob);
        const image = document.createElement("img");
        image.className = "history-thumb";
        image.alt = `${record.barcode} item`;
        image.src = url;
        image.title = "Tap to open item image";
        image.addEventListener("click", () => window.open(url, "_blank"));
        imageCell.replaceChildren(image);
      });
    }
    const values = [
      record.barcode,
      Number(record.horizontalCm).toFixed(2),
      Number(record.verticalCm).toFixed(2),
      record.frameType,
      formatRecordDate(record.measuredAt)
    ];
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    historyTableBody.appendChild(row);
  });
  emptyHistory.hidden = measurementRecords.length > 0;
  exportHistoryButton.disabled = measurementRecords.length === 0;
  exportImagesButton.disabled = !measurementRecords.some(record => record.imageId);
  clearHistoryButton.disabled = measurementRecords.length === 0;
}

function formatRecordDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toLocaleString();
}

async function clearMeasurementHistory() {
  if (!measurementRecords.length) return;
  if (!window.confirm("Clear all measurement history? This cannot be undone.")) return;
  measurementRecords = [];
  localStorage.removeItem("object-measurement-records-v1");
  await clearItemImages();
  updateHistoryCount();
  exportNotice.hidden = true;
  renderHistory();
}

async function exportMeasurementHistory() {
  if (!measurementRecords.length) return;
  const blob = buildMeasurementWorkbook(measurementRecords);
  const filename = `object-measurement-history-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await shareGeneratedFile(blob, filename, "Measurement Excel");
}

async function exportItemImages() {
  const imageRecords = await getAllItemImages();
  if (!imageRecords.length) return;
  const files = {};
  const usedNames = new Set();
  for (const image of imageRecords) {
    let name = image.filename || `${image.id}.jpg`;
    const dot = name.lastIndexOf(".");
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const extension = dot >= 0 ? name.slice(dot) : ".jpg";
    let counter = 2;
    while (usedNames.has(name)) name = `${base}_${counter++}${extension}`;
    usedNames.add(name);
    files[`images/${name}`] = new Uint8Array(await image.blob.arrayBuffer());
  }
  const blob = new Blob([createStoredZip(files)], { type: "application/zip" });
  const filename = `item-images-${new Date().toISOString().slice(0, 10)}.zip`;
  await shareGeneratedFile(blob, filename, "Item image folder");
}

async function shareGeneratedFile(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      exportNotice.hidden = true;
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  if (activeExportUrl) URL.revokeObjectURL(activeExportUrl);
  activeExportUrl = URL.createObjectURL(blob);
  exportNoticeTitle.textContent = "Share is unavailable in this browser";
  exportNoticeFilename.textContent = `Download ${filename}, then share it from your Files app.`;
  exportFileLink.href = activeExportUrl;
  exportFileLink.download = filename;
  exportFileLink.hidden = false;
  exportNotice.hidden = false;
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("object-measurement-images", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("images")) request.result.createObjectStore("images", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveItemImage(id, filename, blob) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("images", "readwrite");
    transaction.objectStore("images").put({ id, filename, blob });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function getItemImage(id) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("images", "readonly").objectStore("images").get(id);
    request.onsuccess = () => { database.close(); resolve(request.result || null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function getAllItemImages() {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("images", "readonly").objectStore("images").getAll();
    request.onsuccess = () => { database.close(); resolve(request.result || []); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function deleteItemImage(id) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("images", "readwrite");
    transaction.objectStore("images").delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function clearItemImages() {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("images", "readwrite");
    transaction.objectStore("images").clear();
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

function buildMeasurementWorkbook(records) {
  const rows = [
    ["No.", "Barcode", "Horizontal (cm)", "Vertical (cm)", "Frame Type", "Measured At", "Annotated Image Filename", "Item Image Filename"],
    ...records.map((record, index) => [
      index + 1, record.barcode, Number(record.horizontalCm), Number(record.verticalCm),
      record.frameType, formatRecordDate(record.measuredAt), record.imageFilename || "", record.itemImageFilename || ""
    ])
  ];
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${excelColumnName(columnIndex + 1)}${rowIndex + 1}`;
      if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(value))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="4" width="18" customWidth="1"/><col min="5" max="5" width="14" customWidth="1"/><col min="6" max="6" width="24" customWidth="1"/><col min="7" max="8" width="48" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:H${rows.length}"/></worksheet>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Measurement History" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheet
  };
  return new Blob([createStoredZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function excelColumnName(number) {
  let name = "";
  while (number > 0) {
    number--;
    name = String.fromCharCode(65 + number % 26) + name;
    number = Math.floor(number / 26);
  }
  return name;
}

function xmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function createStoredZip(fileMap) {
  const encoder = new TextEncoder();
  const entries = [];
  let offset = 0;
  const localParts = [];
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, content] of Object.entries(fileMap)) {
    const nameBytes = encoder.encode(name);
    const data = content instanceof Uint8Array ? content : encoder.encode(content);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0, true);
    view.setUint16(8, 0, true); view.setUint16(10, dosTime, true); view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true); view.setUint16(28, 0, true); header.set(nameBytes, 30);
    localParts.push(header, data);
    entries.push({ nameBytes, crc, size: data.length, offset });
    offset += header.length + data.length;
  }
  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
    view.setUint16(8, 0, true); view.setUint16(10, 0, true); view.setUint16(12, dosTime, true); view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true); view.setUint32(20, entry.size, true); view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true); view.setUint16(30, 0, true); view.setUint16(32, 0, true);
    view.setUint16(34, 0, true); view.setUint16(36, 0, true); view.setUint32(38, 0, true); view.setUint32(42, entry.offset, true);
    header.set(entry.nameBytes, 46); centralParts.push(header); centralSize += header.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(4, 0, true); endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true); endView.setUint16(20, 0, true);
  return concatenateBytes([...localParts, ...centralParts, end]);
}

function concatenateBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let position = 0;
  for (const part of parts) { output.set(part, position); position += part.length; }
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Capture failed")), "image/jpeg", quality);
  });
}

function maskFromSavedBackground(data, background, width, height, threshold, offsetX = 0, offsetY = 0) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const bx = x + offsetX, by = y + offsetY;
      if (bx < 0 || bx >= width || by < 0 || by >= height) continue;
      const bi = (by * width + bx) * 4;
      const dr = data[i] - background[bi];
      const dg = data[i + 1] - background[bi + 1];
      const db = data[i + 2] - background[bi + 2];
      const colourDistance = Math.sqrt(dr * dr + dg * dg + db * db);
      const oldLuma = 0.299 * background[bi] + 0.587 * background[bi + 1] + 0.114 * background[bi + 2];
      const newLuma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const lumaRatio = Math.abs(newLuma - oldLuma) / Math.max(35, oldLuma);
      const oldSum = Math.max(30, background[bi] + background[bi + 1] + background[bi + 2]);
      const newSum = Math.max(30, data[i] + data[i + 1] + data[i + 2]);
      const chromaDistance = Math.sqrt(
        Math.pow(data[i] / newSum - background[bi] / oldSum, 2) +
        Math.pow(data[i + 1] / newSum - background[bi + 1] / oldSum, 2) +
        Math.pow(data[i + 2] / newSum - background[bi + 2] / oldSum, 2)
      ) * 255;
      const strongBrightnessChange = lumaRatio > 0.24;
      const realColourChange = chromaDistance > 9;
      mask[p] = colourDistance > threshold && (strongBrightnessChange || realColourChange) ? 1 : 0;
    }
  }
  return mask;
}

function estimateBackgroundOffset(data, background, width, height, maxShift) {
  const candidates = [];
  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      candidates.push({ dx, dy, distance: Math.abs(dx) + Math.abs(dy) });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);

  const bandX = Math.max(12, Math.round(width * 0.18));
  const bandY = Math.max(10, Math.round(height * 0.18));
  let best = { dx: 0, dy: 0, score: Infinity };
  for (const candidate of candidates) {
    let difference = 0;
    let checked = 0;
    for (let y = 8; y < height - 8; y += 7) {
      for (let x = 8; x < width - 8; x += 7) {
        if (x > bandX && x < width - bandX && y > bandY && y < height - bandY) continue;
        const bx = x + candidate.dx;
        const by = y + candidate.dy;
        if (bx < 0 || bx >= width || by < 0 || by >= height) continue;
        const i = (y * width + x) * 4;
        const bi = (by * width + bx) * 4;
        const currentLuma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const savedLuma = 0.299 * background[bi] + 0.587 * background[bi + 1] + 0.114 * background[bi + 2];
        difference += Math.min(50, Math.abs(currentLuma - savedLuma));
        checked++;
      }
    }
    const score = checked ? difference / checked + candidate.distance * 0.08 : Infinity;
    if (score < best.score) best = { dx: candidate.dx, dy: candidate.dy, score };
  }
  return best;
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
    navigator.serviceWorker.register("service-worker.js?v=0.11.0")
      .then(registration => registration.update())
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("live-object-frame-reloaded") === "0.11.0") return;
      sessionStorage.setItem("live-object-frame-reloaded", "0.11.0");
      window.location.reload();
    });
  });
}
