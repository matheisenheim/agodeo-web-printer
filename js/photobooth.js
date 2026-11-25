import { PRINT_WIDTH } from './protocol.js';

let stream = null;

export async function startCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('caméra indisponible : getUserMedia exige HTTPS ou localhost');
  }
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(video) {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (video) video.srcObject = null;
}

export function cameraRunning() {
  return !!stream;
}

export async function captureFrame(video, width = PRINT_WIDTH, mirror = false) {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || Math.round((width * 3) / 4);
  const h = Math.max(1, Math.round((vh * width) / vw));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, h);
  return createImageBitmap(canvas);
}
