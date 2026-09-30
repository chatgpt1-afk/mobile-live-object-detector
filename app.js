"use strict";

const video = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const overlayCtx = overlay.getContext("2d");
const workCanvas = document.querySelector("#processingCanvas");
const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
const startButton = document.querySelector("#startButton");
const calibrateButton = document.querySelector("#calibrateButton");
const resetButton = document.querySelector("#resetButton");
const thresholdInput = document.querySelector("#threshold");
const minAreaInput = document.querySelector("#minArea");
const thresholdValue = document.querySelector("#thresholdValue");
const areaValue = document.querySelector("#areaValue");
const cameraState = document.querySelector("#cameraState");
const detectionStatus = document.querySelector("#detectionStatus");
const confidenceText = document.querySelector("#confidence");
const fpsText = document.querySelector("#fps");
const liveMessage = document.querySelector("#liveMessage");
const emptyState = document.querySelector("#emptyState");

const PROCESS_WIDTH = 320;
const PROCESS_INTERVAL_MS = 90;
const SMOOTHING = 0.32;

let stream = null;
let running = false;
let lastProcessed = 0;
let previousTick = performance.now();
let backgroundFrame = null;
let smoothedBox = null;
let missingFrames = 0;

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

calibrateButton.addEventListener("click", () => {
  if (!running || video.readyState < 2) return;
  drawWorkFrame();
  backgroundFrame = new Uint8ClampedArray(workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height).data);
  resetButton.disabled = false;
  smoothedBox = null;
  detectionStatus.textContent = "Empty background saved";
  liveMessage.textContent = "Now place one item without moving the phone";
});

resetButton.addEventListener("click", () => {
  backgroundFrame = null;
  resetButton.disabled = true;
  smoothedBox = null;
  detectionStatus.textContent = "Auto background active";
  liveMessage.textContent = "Place one item near the centre";
});

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
    startButton.textContent = "Stop Camera";
    calibrateButton.disabled = false;
    resetButton.disabled = true;
    detectionStatus.textContent = "Looking for one item";
    liveMessage.textContent = "Place one item near the centre";
    resizeCanvases();
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
  startButton.textContent = "Start Camera";
  calibrateButton.disabled = true;
  resetButton.disabled = true;
  detectionStatus.textContent = "Waiting for camera";
  confidenceText.textContent = "—";
  fpsText.textContent = "—";
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
  const mask = backgroundFrame
    ? maskFromSavedBackground(frame.data, backgroundFrame, width, height, threshold)
    : maskFromBorderBackground(frame.data, width, height, threshold);

  closeSmallGaps(mask, width, height, 2);
  majorityFilter(mask, width, height, 1);
  const minimumPixels = width * height * Number(minAreaInput.value) / 1000;
  const candidate = largestCentralComponent(mask, width, height, minimumPixels);

  if (!candidate) {
    missingFrames += 1;
    if (missingFrames > 4) smoothedBox = null;
    drawOverlay(null);
    detectionStatus.textContent = "No clear object";
    confidenceText.textContent = "—";
    liveMessage.textContent = backgroundFrame
      ? "Place one item; keep the phone still"
      : "Use a plain background and centre one item";
    return;
  }

  missingFrames = 0;
  const expanded = expandBox(candidate, width, height, 0.025);
  smoothedBox = smoothBox(smoothedBox, expanded, SMOOTHING);
  const confidence = calculateConfidence(candidate, width, height);
  drawOverlay(smoothedBox);
  detectionStatus.textContent = "Object framed";
  confidenceText.textContent = `${Math.round(confidence * 100)}%`;
  liveMessage.textContent = candidate.touchesEdge
    ? "Move back: part of the item may be outside the picture"
    : "Frame is following the object";
}

function maskFromSavedBackground(data, background, width, height, threshold) {
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const dr = data[i] - background[i];
    const dg = data[i + 1] - background[i + 1];
    const db = data[i + 2] - background[i + 2];
    const colourDistance = Math.sqrt(dr * dr + dg * dg + db * db);
    const oldLuma = (background[i] + background[i + 1] + background[i + 2]) / 3;
    const newLuma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const ratio = Math.abs(newLuma - oldLuma) / Math.max(35, oldLuma);
    mask[p] = colourDistance > threshold && ratio > 0.055 ? 1 : 0;
  }
  return mask;
}

function maskFromBorderBackground(data, width, height, threshold) {
  const samples = [];
  const bandX = Math.max(4, Math.round(width * 0.055));
  const bandY = Math.max(4, Math.round(height * 0.055));
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      if (x > bandX && x < width - bandX && y > bandY && y < height - bandY) continue;
      const i = (y * width + x) * 4;
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const middle = samples[Math.floor(samples.length / 2)] || [128, 128, 128];
  const [br, bg, bb] = middle;
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const dr = data[i] - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    mask[p] = distance > threshold ? 1 : 0;
  }
  return mask;
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

function drawOverlay(box) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (!box) return;
  const sx = overlay.width / workCanvas.width;
  const sy = overlay.height / workCanvas.height;
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
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}
