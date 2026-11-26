import { PRINT_WIDTH } from './protocol.js';

let stream = null;

export async function startCamera(video, deviceId, media = {}, defaultFacing = 'environment') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('caméra indisponible : getUserMedia exige HTTPS ou localhost');
  }
  const otherFacing = defaultFacing === 'user' ? 'environment' : 'user';
  const base = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: defaultFacing };
  const videoConstraints = Object.assign({ width: { ideal: 1280 }, height: { ideal: 720 } }, base, media);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
  } catch (e) {
    if (!deviceId && /facing|notfound|overconstrained|notreadable/i.test(`${e.name} ${e.message}`)) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: Object.assign({ facingMode: otherFacing, width: { ideal: 1280 }, height: { ideal: 720 } }, media),
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

export async function blobToStill(blob, width = PRINT_WIDTH, mirror = false, filter = 'none') {
  const bmp = await createImageBitmap(blob);
  const h = Math.max(1, Math.round((bmp.height * width) / bmp.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (filter && filter !== 'none' && 'filter' in ctx) ctx.filter = filter;
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(bmp, 0, 0, width, h);
  if (bmp.close) bmp.close();
  return createImageBitmap(canvas);
}

export async function captureStill(video, width = PRINT_WIDTH, mirror = false, filter = 'none') {
  const track = video.srcObject ? video.srcObject.getVideoTracks()[0] : null;
  if (track && typeof ImageCapture !== 'undefined') {
    try {
      const ic = new ImageCapture(track);
      const blob = await ic.takePhoto();
      return await blobToStill(blob, width, mirror, filter);
    } catch (e) {
      // repli sur la trame d'aperçu si takePhoto indisponible
    }
  }
  return captureFrame(video, width, mirror, filter);
}

export function stopStream(s) {
  if (s) s.getTracks().forEach((t) => t.stop());
}

function idealOf(v, dflt) {
  if (v === undefined || v === null) return dflt;
  if (typeof v === 'object') return v.ideal || dflt;
  return v;
}

export async function openCaptureStream({ deviceId, media = {}, advanced } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('getUserMedia indisponible (HTTPS ou localhost requis)');
  }
  const video = Object.assign(
    {
      width: { ideal: idealOf(media.width, 1920) },
      height: { ideal: idealOf(media.height, 1080) },
      frameRate: { ideal: idealOf(media.frameRate, 30) },
    },
    deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
  );
  if (advanced && advanced.length) video.advanced = advanced;
  return await navigator.mediaDevices.getUserMedia({ video, audio: false });
}

export async function captureBlobFromTrack(track) {
  if (!track || typeof ImageCapture === 'undefined') {
    throw new Error('ImageCapture indisponible pour ce track');
  }
  const ic = new ImageCapture(track);
  return await ic.takePhoto();
}

export async function applyAdvancedToTrack(track, obj) {
  if (!track || !track.applyConstraints) return false;
  try {
    await track.applyConstraints({ advanced: [obj] });
    return true;
  } catch (e) {
    return false;
  }
}

export async function waitAppliedExposure(track, target, timeoutMs = 2000) {
  if (!track || target === undefined || target === null) return undefined;
  const t0 = performance.now();
  let last;
  while (performance.now() - t0 < timeoutMs) {
    const st = track.getSettings ? track.getSettings() : {};
    last = st.exposureTime;
    if (last !== undefined && Math.abs(last - target) <= Math.max(0.001, Math.abs(target) * 0.02)) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  return last;
}

export function measureLuma(video, w = 64, h = 36) {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / n;
}

export async function accumulateLongExposure(video, seconds, mirror = false, filter = 'none', accWidth = 640, gain = 1) {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || Math.round((vw * 3) / 4);
  const aw = accWidth;
  const ah = Math.max(1, Math.round((vh * aw) / vw));
  const acc = document.createElement('canvas');
  acc.width = aw;
  acc.height = ah;
  const actx = acc.getContext('2d');
  actx.globalCompositeOperation = 'lighter';
  const dur = seconds * 1000;
  const frames = Math.max(1, Math.round(dur / 100));
  actx.globalAlpha = 1 / frames;
  const t0 = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      if (performance.now() - t0 >= dur || !video.srcObject) {
        resolve();
        return;
      }
      if (video.readyState >= 2) actx.drawImage(video, 0, 0, aw, ah);
      setTimeout(step, 100);
    };
    step();
  });
  actx.globalAlpha = 1;
  const width = PRINT_WIDTH;
  const h = Math.max(1, Math.round((ah * width) / aw));
  const out = document.createElement('canvas');
  out.width = width;
  out.height = h;
  const octx = out.getContext('2d');
  const filters = [];
  if (filter && filter !== 'none') filters.push(filter);
  if (gain && gain !== 1) filters.push(`brightness(${gain})`);
  if (filters.length && 'filter' in octx) octx.filter = filters.join(' ');
  if (mirror) {
    octx.translate(width, 0);
    octx.scale(-1, 1);
  }
  octx.drawImage(acc, 0, 0, width, h);
  return createImageBitmap(out);
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
