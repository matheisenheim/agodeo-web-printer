export const APP_VERSION = '3.2.28';

export const SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb';
export const CHAR_WRITE_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';
export const CHAR_NOTIFY_UUID = '0000ae02-0000-1000-8000-00805f9b34fb';
export const CHAR_DATA_UUID = '0000ae03-0000-1000-8000-00805f9b34fb';

export const PRINT_WIDTH = 384;
export const LINE_BYTES = PRINT_WIDTH / 8;

export const HEADER_CAT = [0x51, 0x78];
export const HEADER_MXW = [0x22, 0x21];

export const CAT = {
  retract: 0xa0,
  feed: 0xa1,
  drawLine: 0xa2,
  getState: 0xa3,
  setQuality: 0xa4,
  lattice: 0xa6,
  getInfo: 0xa8,
  lineControl: 0xae,
  setEnergy: 0xaf,
  feedSpeed: 0xbd,
  drawMode: 0xbe,
};

export const MXW = {
  status: 0xa1,
  intensity: 0xa2,
  feed: 0xa3,
  retract: 0xa4,
  queryCount: 0xa7,
  printRequest: 0xa9,
  printComplete: 0xaa,
  battery: 0xab,
  cancel: 0xac,
  flush: 0xad,
  printType: 0xb0,
  version: 0xb1,
};

export const LATTICE_START = Uint8Array.from([0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c]);
export const LATTICE_END = Uint8Array.from([0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17]);

export const STATE = {
  noPaper: 0x01,
  coverOpen: 0x02,
  headHot: 0x04,
  lowBattery: 0x08,
  busy: 0x80,
};

export const MXW_STATE = ['veille', 'impression en cours', 'avance du papier', 'éjection'];
export const MXW_ERROR = {
  0x01: 'pas de papier',
  0x09: 'pas de papier',
  0x04: 'tête chaude (surchauffe)',
  0x08: 'batterie faible',
};

export function crc8(bytes) {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function buildPacket(cmd, payload, header) {
  const h = header || HEADER_CAT;
  const data = payload || new Uint8Array(0);
  const len = data.length;
  const out = new Uint8Array(6 + len + 2);
  out[0] = h[0];
  out[1] = h[1];
  out[2] = cmd;
  out[3] = 0x00;
  out[4] = len & 0xff;
  out[5] = (len >> 8) & 0xff;
  out.set(data, 6);
  out[6 + len] = crc8(data);
  out[7 + len] = 0xff;
  return out;
}

export function parsePacket(bytes) {
  if (!bytes || bytes.length < 7) return null;
  const headOk = (bytes[0] === 0x51 && bytes[1] === 0x78) || (bytes[0] === 0x22 && bytes[1] === 0x21);
  if (!headOk) return null;
  const len = bytes[4] | (bytes[5] << 8);
  if (bytes.length < 6 + len + 1) return null;
  const payload = bytes.slice(6, 6 + len);
  return {
    cmd: bytes[2],
    dir: bytes[3],
    len,
    payload,
    crcOk: bytes[6 + len] === crc8(payload),
    hasFooter: bytes[6 + len + 1] === 0xff,
  };
}

export function stateToText(flags) {
  const parts = [];
  if (flags & STATE.noPaper) parts.push('pas de papier / capot ouvert');
  if (flags & STATE.coverOpen) parts.push('couvercle ouvert');
  if (flags & STATE.headHot) parts.push('tête chaude');
  if (flags & STATE.lowBattery) parts.push('batterie faible');
  if (flags & STATE.busy) parts.push('impression en cours');
  return parts.length ? parts.join(', ') : 'OK';
}

export function mxwStatusToText(p) {
  if (!p || !p.length) return 'réponse vide';
  const parts = [];
  parts.push(MXW_STATE[p[0]] || `état ${p[0]}`);
  if (p.length > 3) parts.push(`batterie ${p[3]}%`);
  if (p.length > 4) parts.push(`tête ${p[4]}°C`);
  if (p.length > 6 && p[6] !== 0) parts.push(`ERREUR : ${MXW_ERROR[p[7]] || `code ${p[7]}`}`);
  else parts.push('OK');
  return parts.join(', ');
}

export function formatQueryCount(payload) {
  if (!payload || !payload.length) return null;
  if (Array.from(payload).every((b) => b === 0xff)) return 'indisponible (FF…)';
  const hexStr = Array.from(payload).map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const le16 = payload.length >= 2 ? payload[0] | (payload[1] << 8) : null;
  return `0x${hexStr}${le16 !== null ? ` (LE16=${le16})` : ''}`;
}

export function hex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}
