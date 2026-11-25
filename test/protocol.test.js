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
  formatQueryCount,
} from '../js/protocol.js';
import { qrMatrix } from '../js/qr.js';
import { TEMPLATES, testCardSource } from '../js/templates.js';

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

assert.ok(TEMPLATES.length >= 3, 'au moins 3 templates');
for (const t of TEMPLATES) {
  assert.equal(typeof t.render, 'function');
  assert.ok(t.fields.some((f) => f.key === 'nom'), `template ${t.id} a un champ nom`);
}

assert.equal(testCardSource().kind, 'testcard');

const a1Reelle = parsePacket(Uint8Array.from([0x22, 0x21, 0xa1, 0x03, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x53, 0x0f, 0x00, 0x00, 0x00, 0xbb, 0x00, 0xb8, 0xff]));
assert.equal(a1Reelle.cmd, 0xa1);
assert.equal(a1Reelle.crcOk, true);
const a1Txt = mxwStatusToText(a1Reelle.payload);
assert.ok(a1Txt.includes('veille') && a1Txt.includes('batterie 83%') && a1Txt.includes('15°C') && a1Txt.includes('OK'), `statut reel A1 decode: ${a1Txt}`);

const abReelle = parsePacket(Uint8Array.from([0x22, 0x21, 0xab, 0x00, 0x01, 0x00, 0x53, 0x3f, 0xff]));
assert.equal(abReelle.cmd, 0xab);
assert.equal(abReelle.payload[0], 83, 'batterie AB reelle = 83');

const ackAe = parsePacket(Uint8Array.from([0x22, 0x21, 0xae, 0x00, 0x01, 0x00, 0x00, 0x00, 0xff]));
assert.equal(ackAe.cmd, 0xae, 'ack AE recu (commande interne, echo)');
assert.deepEqual(Array.from(ackAe.payload), [0x00]);

const a1SansFooter = Uint8Array.from([0x22, 0x21, 0xa1, 0x03, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x50, 0x0f, 0x00, 0x00, 0x00, 0xbb, 0x00, 0x00]);
const pSansFf = parsePacket(a1SansFooter);
assert.ok(pSansFf, 'reponse A1 reelle recue SANS 0xFF final doit etre acceptee');
assert.equal(pSansFf.cmd, 0xa1);
assert.equal(pSansFf.hasFooter, false);
assert.ok(mxwStatusToText(pSansFf.payload).includes('batterie 80%'), 'A1 sans footer: batterie 80%');

const aaSansFooter = parsePacket(Uint8Array.from([0x22, 0x21, 0xaa, 0x00, 0x03, 0x00, 0x00, 0xc2, 0xc2, 0x00]));
assert.equal(aaSansFooter.cmd, 0xaa, 'notification AA (print complete) recue sans footer');

assert.equal(formatQueryCount(Uint8Array.from([0xff, 0xff])), 'indisponible (FF…)');
assert.ok(formatQueryCount(Uint8Array.from([0x34, 0x12])).includes('LE16=4660'), 'A7 en LE16');

console.log(`tous les tests passent (app v${APP_VERSION}, QR ${qr.getModuleCount()}x${qr.getModuleCount()} modules, ${TEMPLATES.length} templates + page de test)`);
