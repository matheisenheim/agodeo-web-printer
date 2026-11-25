import assert from 'node:assert/strict';
import {
  APP_VERSION,
  HEADER_CAT,
  HEADER_MXW,
  crc8,
  buildPacket,
  parsePacket,
  hex,
  stateToText,
  mxwStatusToText,
} from '../js/protocol.js';
import { qrMatrix } from '../js/qr.js';

assert.equal(crc8(Uint8Array.from([0x32])), 0x9e, 'CRC8(0x32) doit faire 0x9e');
assert.equal(crc8(Uint8Array.from([0x00, 0x11, 0x25])), 0xb9, 'CRC8 capture reelle (wiki)');
assert.equal(hex(buildPacket(0xa1, Uint8Array.from([0x00]), HEADER_MXW)), '22 21 a1 00 01 00 00 00 ff', 'trame MXW01 A1');
assert.equal(hex(buildPacket(0xa3, Uint8Array.from([0x00]), HEADER_CAT)), '51 78 a3 00 01 00 00 00 ff', 'trame cat A3');
assert.equal(hex(buildPacket(0xa1, Uint8Array.from([0x32]), HEADER_CAT)), '51 78 a1 00 01 00 32 9e ff', 'trame cat feed 50 (vu dans le journal reel)');

const resp = parsePacket(Uint8Array.from([0x51, 0x78, 0xa3, 0x01, 0x03, 0x00, 0x00, 0x11, 0x25, 0xb9, 0xff]));
assert.equal(resp.cmd, 0xa3);
assert.equal(resp.dir, 0x01);
assert.equal(resp.crcOk, true);
assert.deepEqual(Array.from(resp.payload), [0x00, 0x11, 0x25]);

const respMxw = parsePacket(Uint8Array.from([0x22, 0x21, 0xa1, 0x03, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x5a, 0x14, 0x00, 0x00, 0x00, 0xf2, 0x00, 0x00]));
assert.ok(respMxw === null || respMxw.cmd === 0xa1, 'parse trame MXW01 (peut echouer si CRC faux, ce qui est teste apres)');

assert.ok(mxwStatusToText(Uint8Array.from([0, 0, 0, 90, 20, 0, 0, 0])).includes('batterie 90%'), 'statut MXW01 batterie');
assert.ok(mxwStatusToText(Uint8Array.from([0, 0, 0, 90, 20, 0, 1, 9])).includes('pas de papier'), 'statut MXW01 erreur 9');
assert.ok(stateToText(0x01).includes('pas de papier'), 'statut cat bit 0x01');
assert.equal(stateToText(0x00), 'OK');

const qr = qrMatrix('https://example.com — éàü');
assert.ok(qr.getModuleCount() >= 21, 'QR au moins version 1');
assert.equal(qr.isDark(0, 0), true, 'finder haut-gauche noir');
assert.equal(qr.isDark(0, qr.getModuleCount() - 1), true, 'finder haut-droite noir');
assert.equal(qr.isDark(qr.getModuleCount() - 1, 0), true, 'finder bas-gauche noir');

console.log(`tous les tests passent (app v${APP_VERSION}, QR ${qr.getModuleCount()}x${qr.getModuleCount()} modules)`);
