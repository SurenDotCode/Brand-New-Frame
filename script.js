const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.8;
const EXPORT_FILENAME = "brand-new-frame.png";

const $ = (selector) => document.querySelector(selector);

const els = {
  input: $("#fileInput"),
  shell: $("#frameShell"),
  stage: $("#photoStage"),
  photo: $("#photo"),
  backdrop: $("#photoBackdrop"),
  empty: $("#emptyState"),
  zoom: $("#zoom"),
  zoomValue: $("#zoomValue"),
  status: $("#status"),
  preview: $("#previewScreen"),
  previewPhoto: $("#previewPhoto"),
  previewBackdrop: $("#previewBackdrop"),
  previewCard: $("#previewCard")
};

const state = {
  objectUrl: "",
  mode: "contain",
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  drag: null,
  pointers: new Map(),
  pinch: null,
  statusTimer: null
};

function hasPhoto() {
  return Boolean(state.objectUrl);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function openPicker() {
  els.input.click();
}

function setStatus(message, ready = false) {
  els.status.replaceChildren();
  const indicator = document.createElement("span");
  indicator.setAttribute("aria-hidden", "true");
  els.status.append(indicator, document.createTextNode(` ${message}`));
  els.status.style.background = ready ? "var(--cyan)" : "var(--peach)";

  window.clearTimeout(state.statusTimer);
  if (!ready) {
    state.statusTimer = window.setTimeout(() => setStatus("READY", true), 1500);
  }
}

function resetTransform() {
  state.mode = "contain";
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  state.rotation = 0;
  els.zoom.value = "100";
}

function applyTransform() {
  const transform = `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px)) scale(${state.scale}) rotate(${state.rotation}deg)`;
  els.photo.style.objectFit = state.mode;
  els.photo.style.transform = transform;
  els.zoomValue.value = `${Math.round(state.scale * 100)}%`;
  syncPreview();
}

function setScale(nextScale) {
  state.scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
  els.zoom.value = String(Math.round(state.scale * 100));
  applyTransform();
}

function movePhoto(dx, dy) {
  if (!hasPhoto()) return;
  state.x += dx;
  state.y += dy;
  applyTransform();
}

function loadPhoto(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("IMAGE REQUIRED");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setStatus("IMAGE TOO LARGE");
    return;
  }

  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);

  els.photo.src = state.objectUrl;
  els.backdrop.src = state.objectUrl;
  els.previewPhoto.src = state.objectUrl;
  els.previewBackdrop.src = state.objectUrl;

  els.photo.onload = () => {
    els.photo.style.display = "block";
    els.backdrop.style.opacity = ".7";
    els.empty.style.display = "none";
    els.shell.classList.add("has-photo");
    resetTransform();
    applyTransform();
    setStatus("PHOTO LOADED");
  };

  els.photo.onerror = () => {
    clearPhoto();
    setStatus("IMAGE FAILED");
  };
}

function clearPhoto() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = "";

  els.photo.removeAttribute("src");
  els.backdrop.removeAttribute("src");
  els.previewPhoto.removeAttribute("src");
  els.previewBackdrop.removeAttribute("src");
  els.photo.style.display = "none";
  els.backdrop.style.opacity = "0";
  els.empty.style.display = "grid";
  els.shell.classList.remove("has-photo", "dragging");
  resetTransform();
  applyTransform();
}

function syncPreview() {
  if (!hasPhoto() || !els.preview.classList.contains("active")) return;

  const editorWidth = els.stage.clientWidth || 1;
  const editorHeight = els.stage.clientHeight || 1;
  const previewStage = els.previewPhoto.parentElement;
  const previewWidth = previewStage?.clientWidth || editorWidth;
  const previewHeight = previewStage?.clientHeight || editorHeight;

  const px = state.x * (previewWidth / editorWidth);
  const py = state.y * (previewHeight / editorHeight);

  els.previewPhoto.style.objectFit = state.mode;
  els.previewPhoto.style.transform =
    `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(${state.scale}) rotate(${state.rotation}deg)`;
}

function openPreview() {
  if (!hasPhoto()) {
    openPicker();
    return;
  }
  syncPreview();
  els.preview.classList.add("active");
  els.preview.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePreview() {
  els.preview.classList.remove("active");
  els.preview.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function updatePointer(id, event) {
  state.pointers.set(id, { x: event.clientX, y: event.clientY });
}

function pointerDistance() {
  const points = [...state.pointers.values()];
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function startPointer(event) {
  if (!hasPhoto() || event.target.closest("button")) return;

  updatePointer(event.pointerId, event);
  els.shell.setPointerCapture?.(event.pointerId);

  if (state.pointers.size === 2) {
    state.pinch = {
      distance: pointerDistance(),
      scale: state.scale
    };
    state.drag = null;
    els.shell.classList.remove("dragging");
    return;
  }

  state.drag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    baseX: state.x,
    baseY: state.y
  };
  els.shell.classList.add("dragging");
}

function movePointer(event) {
  if (!state.pointers.has(event.pointerId)) return;
  updatePointer(event.pointerId, event);

  if (state.pointers.size >= 2 && state.pinch) {
    const distance = pointerDistance();
    if (state.pinch.distance > 0) {
      setScale(state.pinch.scale * (distance / state.pinch.distance));
    }
    return;
  }

  if (!state.drag || state.drag.id !== event.pointerId) return;
  state.x = state.drag.baseX + (event.clientX - state.drag.startX);
  state.y = state.drag.baseY + (event.clientY - state.drag.startY);
  applyTransform();
}

function endPointer(event) {
  state.pointers.delete(event.pointerId);
  if (state.drag?.id === event.pointerId) state.drag = null;

  if (state.pointers.size < 2) state.pinch = null;
  if (!state.drag) els.shell.classList.remove("dragging");
}

function handleWheel(event) {
  if (!hasPhoto()) return;
  event.preventDefault();
  const sensitivity = event.ctrlKey ? 0.012 : 0.004;
  setScale(state.scale - event.deltaY * sensitivity);
}

async function decodeImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function drawPhoto(ctx, image, canvasWidth, canvasHeight) {
  const baseScale = state.mode === "cover"
    ? Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight)
    : Math.min(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);

  const scale = baseScale * state.scale;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const stageWidth = els.stage.clientWidth || 1;
  const stageHeight = els.stage.clientHeight || 1;
  const x = canvasWidth / 2 + state.x * (canvasWidth / stageWidth);
  const y = canvasHeight / 2 + state.y * (canvasHeight / stageHeight);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(state.rotation * Math.PI / 180);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

async function exportFrame() {
  if (!hasPhoto()) {
    openPicker();
    return;
  }

  setStatus("EXPORTING...");

  try {
    const [frame, image] = await Promise.all([
      decodeImage("frame-overlay.png"),
      decodeImage(state.objectUrl)
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = frame.naturalWidth;
    canvas.height = frame.naturalHeight;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#020914";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const coverScale = Math.max(
      canvas.width / image.naturalWidth,
      canvas.height / image.naturalHeight
    );
    const backdropWidth = image.naturalWidth * coverScale;
    const backdropHeight = image.naturalHeight * coverScale;

    ctx.save();
    ctx.globalAlpha = .22;
    ctx.filter = "blur(18px) brightness(.45) saturate(.8)";
    ctx.drawImage(
      image,
      (canvas.width - backdropWidth) / 2,
      (canvas.height - backdropHeight) / 2,
      backdropWidth,
      backdropHeight
    );
    ctx.restore();

    drawPhoto(ctx, image, canvas.width, canvas.height);
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG export failed")), "image/png");
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = EXPORT_FILENAME;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("EXPORTED", true);
  } catch (error) {
    console.error("Frame export failed:", error);
    setStatus("EXPORT FAILED");
  }
}

// File input / upload actions.
$("#uploadBtn").addEventListener("click", openPicker);
$("#stageUpload").addEventListener("click", openPicker);
els.input.addEventListener("change", () => loadPhoto(els.input.files?.[0]));

// Editor controls.
els.zoom.addEventListener("input", () => setScale(Number(els.zoom.value) / 100));
$("#fitBtn").addEventListener("click", () => {
  resetTransform();
  applyTransform();
});
$("#coverBtn").addEventListener("click", () => {
  state.mode = "cover";
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  els.zoom.value = "100";
  applyTransform();
});
$("#leftBtn").addEventListener("click", () => movePhoto(-14, 0));
$("#rightBtn").addEventListener("click", () => movePhoto(14, 0));
$("#upBtn").addEventListener("click", () => movePhoto(0, -14));
$("#downBtn").addEventListener("click", () => movePhoto(0, 14));
$("#rotateLeft").addEventListener("click", () => { state.rotation -= 90; applyTransform(); });
$("#rotateRight").addEventListener("click", () => { state.rotation += 90; applyTransform(); });
$("#resetBtn").addEventListener("click", () => {
  clearPhoto();
  closePreview();
  setStatus("READY", true);
});

// Pointer interaction: mouse drag, touch drag, and two-finger pinch zoom.
els.shell.addEventListener("pointerdown", startPointer);
els.shell.addEventListener("pointermove", movePointer);
els.shell.addEventListener("pointerup", endPointer);
els.shell.addEventListener("pointercancel", endPointer);
els.shell.addEventListener("wheel", handleWheel, { passive: false });

// Desktop drag/drop upload.
els.shell.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.shell.classList.add("dragging");
});
els.shell.addEventListener("dragleave", () => els.shell.classList.remove("dragging"));
els.shell.addEventListener("drop", (event) => {
  event.preventDefault();
  els.shell.classList.remove("dragging");
  loadPhoto(event.dataTransfer.files?.[0]);
});

// Preview / export.
$("#nextBtn").addEventListener("click", openPreview);
$("#closePreview").addEventListener("click", closePreview);
$("#downloadBtn").addEventListener("click", exportFrame);

window.addEventListener("resize", syncPreview);
window.addEventListener("beforeunload", () => {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
});
