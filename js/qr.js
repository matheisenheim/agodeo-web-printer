import qrcode from '../vendor/qrcode.mjs';
import '../vendor/qrcode_UTF8.mjs';

export function qrSource(text) {
  return { kind: 'qr', text: text || ' ' };
}

export function qrMatrix(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text || ' ');
  qr.make();
  return qr;
}
