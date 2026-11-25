export const APP_VERSION = '1.4.1';

export const SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb';
export const CHAR_WRITE_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';
export const CHAR_NOTIFY_UUID = '0000ae02-0000-1000-8000-00805f9b34fb';

export const PRINT_WIDTH = 384;
export const LINE_BYTES = PRINT_WIDTH / 8;

export const CMD = {
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

export const LATTICE_START = Uint8Array.from([0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c]);
export const LATTICE_END = Uint8Array.from([0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17]);

export const STATE = {
  noPaper: 0x01,
  coverOpen: 0x02,
  headHot: 0x04,
  lowBattery: 0x08,
  busy: 0x80,
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

export function buildPacket(cmd, payload) {
  const data = payload || new Uint8Array(0);
  const len = data.length;
  const out = new Uint8Array(6 + len + 2);
  out[0] = 0x51;
  out[1] = 0x78;
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
  if (!bytes || bytes.length < 8) return null;
  if (bytes[0] !== 0x51 || bytes[1] !== 0x78 || bytes[bytes.length - 1] !== 0xff) return null;
  const len = bytes[4] | (bytes[5] << 8);
  if (bytes.length < 6 + len + 2) return null;
  const payload = bytes.slice(6, 6 + len);
  return {
    cmd: bytes[2],
    dir: bytes[3],
    len,
    payload,
    crcOk: bytes[6 + len] === crc8(payload),
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

export function hex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}
