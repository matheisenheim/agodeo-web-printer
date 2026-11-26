import { PRINT_WIDTH } from './protocol.js';

let stream = null;

export async function startCamera(video, deviceId, media = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('caméra indisponible : getUserMedia exige HTTPS ou localhost');
  }
  const base = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: 'environment' };
  const videoConstraints = Object.assign({ width: { ideal: 1280 }, height: { ideal: 720 } }, base, media);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  } catch (e) {
    if (!deviceId && /facing|notfound|overconstrained|notreadable/i.test(`${e.name} ${e.message}`)) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: Object.assign({ facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, media),
        audio: false,
      });
    } else {
      throw e;
    }
  }
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function trackCaps() {
  const t = videoTrack();
  return t && t.getCapabilities ? t.getCapabilities() : {};
}

export function trackSettings() {
  const t = videoTrack();
  return t && t.getSettings ? t.getSettings() : {};
}

export async function applyAdvanced(obj) {
  const t = videoTrack();
  if (!t || !t.applyConstraints) return false;
  try {
    await t.applyConstraints({ advanced: [obj] });
    return true;
  } catch (e) {
    return false;
  }
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

export function videoTrack() {
  return stream ? stream.getVideoTracks()[0] : null;
}

export function zoomCaps() {
  const t = videoTrack();
  const c = t && t.getCapabilities ? t.getCapabilities() : {};
  return c.zoom ? { min: c.zoom.min, max: c.zoom.max, step: c.zoom.step || 0.1 } : null;
}

export async function setZoom(z) {
  const t = videoTrack();
  if (!t || !t.applyConstraints) return false;
  const c = t.getCapabilities ? t.getCapabilities() : {};
  if (!c.zoom) return false;
  const v = Math.max(c.zoom.min, Math.min(c.zoom.max, z));
  try {
    await t.applyConstraints({ advanced: [{ zoom: v }] });
    return true;
  } catch (e) {
    return false;
  }
}

export async function setFocusMode(mode) {
  if (!stream) return false;
  const t = stream.getVideoTracks()[0];
  if (!t || !t.applyConstraints) return false;
  try {
    await t.applyConstraints({ advanced: [{ focusMode: mode }] });
    return true;
  } catch (e) {
    return false;
  }
}

export async function focusAt(nx, ny) {
  if (!stream) return false;
  const t = stream.getVideoTracks()[0];
  if (!t || !t.applyConstraints) return false;
  try {
    await t.applyConstraints({ advanced: [{ pointsOfInterest: [{ x: nx, y: ny }] }] });
    return true;
  } catch (e) {
    return false;
  }
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
