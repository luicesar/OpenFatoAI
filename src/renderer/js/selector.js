const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

let img        = null;
let isDrawing  = false;
let startCssX  = 0, startCssY = 0;
let curCssX    = 0, curCssY   = 0;

// Convert CSS-pixel coordinates to image-pixel coordinates (handles HiDPI).
function cssToImg(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  return [
    cx * (canvas.width  / rect.width),
    cy * (canvas.height / rect.height),
  ];
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Full screenshot as background
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!isDrawing) return;

  const [x1, y1] = cssToImg(Math.min(startCssX, curCssX), Math.min(startCssY, curCssY));
  const [x2, y2] = cssToImg(Math.max(startCssX, curCssX), Math.max(startCssY, curCssY));
  const w = x2 - x1;
  const h = y2 - y1;
  if (w < 1 || h < 1) return;

  // Restore selected area (clear dim)
  ctx.drawImage(img, x1, y1, w, h, x1, y1, w, h);

  // Selection border — 3px in image-space looks visible at any scale
  ctx.strokeStyle = '#00c8ff';
  ctx.lineWidth   = 3;
  ctx.strokeRect(x1, y1, w, h);
}

async function init() {
  const dataUrl = await window.selectorAPI.getScreenshot();
  img = new Image();
  await new Promise(resolve => { img.onload = resolve; img.src = dataUrl; });

  // Canvas internal size = image natural size (full resolution, HiDPI safe)
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;

  redraw();
}

canvas.addEventListener('mousedown', e => {
  isDrawing = true;
  startCssX = curCssX = e.clientX;
  startCssY = curCssY = e.clientY;
});

canvas.addEventListener('mousemove', e => {
  if (!isDrawing) return;
  curCssX = e.clientX;
  curCssY = e.clientY;
  redraw();
});

canvas.addEventListener('mouseup', e => {
  if (!isDrawing || !img) return;
  isDrawing = false;

  const [x1, y1] = cssToImg(Math.min(startCssX, e.clientX), Math.min(startCssY, e.clientY));
  const [x2, y2] = cssToImg(Math.max(startCssX, e.clientX), Math.max(startCssY, e.clientY));
  const ix = Math.round(x1);
  const iy = Math.round(y1);
  const iw = Math.round(x2 - x1);
  const ih = Math.round(y2 - y1);

  // Ignore tiny accidental clicks
  if (iw < 10 || ih < 10) {
    window.selectorAPI.cancel();
    return;
  }

  // Crop at full image resolution so OCR gets maximum detail
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width  = iw;
  cropCanvas.height = ih;
  cropCanvas.getContext('2d').drawImage(img, ix, iy, iw, ih, 0, 0, iw, ih);
  window.selectorAPI.done(cropCanvas.toDataURL('image/png'));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.selectorAPI.cancel();
});

init();
