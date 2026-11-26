import { PRINT_WIDTH } from './protocol.js';

let stream = null;

export async function startCamera(video, deviceId) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('caméra indisponible : getUserMedia exige HTTPS ou localhost');
  }
  const videoConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
  stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export async function listCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
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

export function currentFacing() {
  if (!stream) return null;
  const t = stream.getVideoTracks()[0];
  if (!t || !t.getSettings) return null;
  return t.getSettings().facingMode || null;
}

export function currentDeviceId() {
  if (!stream) return null;
  const t = stream.getVideoTracks()[0];
  if (!t || !t.getSettings) return null;
  return t.getSettings().deviceId || null;
}

export function torchSupported() {
  if (!stream) return false;
  const t = stream.getVideoTracks()[0];
  const caps = t && t.getCapabilities ? t.getCapabilities() : {};
  return !!caps.torch;
}

export function torchIsOn() {
  if (!stream) return false;
  const t = stream.getVideoTracks()[0];
  const s = t && t.getSettings ? t.getSettings() : {};
  return !!s.torch;
}

export async function setTorch(on) {
  if (!stream) return false;
  const t = stream.getVideoTracks()[0];
  if (!t || !t.applyConstraints || !torchSupported()) return false;
  try {
    await t.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch (e) {
    return false;
  }
}

export async function captureFrame(video, width = PRINT_WIDTH, mirror = false, filter = 'none') {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || Math.round((width * 3) / 4);
  const h = Math.max(1, Math.round((vh * width) / vw));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (filter && filter !== 'none' && 'filter' in ctx) ctx.filter = filter;
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, h);
  return createImageBitmap(canvas);
}
