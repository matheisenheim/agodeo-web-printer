import {
  SERVICE_UUID,
  CHAR_WRITE_UUID,
  CHAR_NOTIFY_UUID,
  CHAR_DATA_UUID,
  LINE_BYTES,
  HEADER_CAT,
  HEADER_MXW,
  CAT,
  MXW,
  LATTICE_START,
  LATTICE_END,
  STATE,
  buildPacket,
  parsePacket,
  stateToText,
  mxwStatusToText,
  hex,
} from './protocol.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CatPrinter {
  constructor() {
    this.device = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.dataChar = null;
    this.isMxw = false;
    this.header = HEADER_CAT;
    this.paused = false;
    this.lastState = null;
    this.lastBattery = null;
    this._pollTimer = null;
    this.onLog = () => {};
    this.onState = () => {};
    this.onDisconnect = () => {};
    this._resumeWaiters = [];
    this._rx = new Uint8Array(0);
    this._cmdWaiters = new Map();
  }

  get connected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  async connect(namePrefix = '') {
    const options = namePrefix
      ? { filters: [{ namePrefix }], optionalServices: [SERVICE_UUID] }
      : { acceptAllDevices: true, optionalServices: [SERVICE_UUID] };
    this.device = await navigator.bluetooth.requestDevice(options);
    await this._attach(this.device);
    return this.device;
  }

  async reconnect(deviceId) {
    const devices = await navigator.bluetooth.getDevices();
    const d = devices.find((x) => x.id === deviceId);
    if (!d) throw new Error('appareil non autorisé par le navigateur : repasse par « Connecter l\'imprimante »');
    await this._attach(d);
    return d;
  }

  async _attach(device) {
    this.device = device;
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());
    const server = await this._connectGattWithRetry();
    const channel = await this._findChannel(server);
    this.writeChar = channel.write;
    this.notifyChar = channel.notify;
    this.notifyChars = channel.notifyChars;
    this.dataChar = channel.data;
    this.isMxw = !!this.dataChar;
    this.header = this.isMxw ? HEADER_MXW : HEADER_CAT;
    this.onLog(`protocole détecté : ${this.isMxw ? 'MXW01 (trames 22 21, données image sur AE03)' : 'cat classique (trames 51 78)'}`);
    for (const nc of this.notifyChars) {
      await nc.startNotifications();
      nc.addEventListener('characteristicvaluechanged', (e) => {
        this._onNotify(new Uint8Array(e.target.value.buffer, e.target.value.byteOffset, e.target.value.byteLength));
      });
      this.onLog(`notifications activées sur ${nc.uuid}`);
    }
    this.onLog(`connecté à ${this.device.name || this.device.id}`);
    if (this.isMxw) {
      await sleep(500);
      await this._request(MXW.version, Uint8Array.from([0x00]), 2000);
      await sleep(200);
      await this.getState(2500);
    } else {
      await this.send(CAT.getInfo, Uint8Array.from([0x00]));
      await sleep(300);
      await this.send(CAT.lineControl, Uint8Array.from([0x00]));
      await sleep(100);
      await this.send(CAT.getState, Uint8Array.from([0x00]));
      await sleep(300);
    }
    return this.device;
  }

  async _connectGattWithRetry(attempts = 3) {
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        if (!this.device.gatt.connected) {
          await this.device.gatt.connect();
        }
        if (this.device.gatt.connected) return this.device.gatt;
      } catch (e) {
        lastErr = e;
        this.onLog(`connexion GATT tentative ${i + 1}/${attempts} : ${e.message}`);
      }
      await sleep(800);
    }
    throw lastErr || new Error('connexion GATT impossible');
  }

  async _ensureConnected(server) {
    if (!server.connected) {
      this.onLog('GATT déconnecté, reconnexion…');
      return this._connectGattWithRetry();
    }
    return server;
  }

  async _findChannel(server) {
    server = await this._ensureConnected(server);
    let service = null;
    try {
      service = await server.getPrimaryService(SERVICE_UUID);
    } catch (e) {
      server = await this._ensureConnected(server);
      const services = await server.getPrimaryServices();
      service = services.find((s) => s.uuid.includes('ae30') || s.uuid.includes('af30')) || services[0];
      this.onLog(`services BLE trouvés : ${services.map((s) => s.uuid).join(', ')}`);
    }
    const chars = await service.getCharacteristics();
    const write = chars.find((c) => c.uuid.includes('ae01') || c.uuid.includes('af01'))
      || chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    const notifyChars = chars.filter((c) => c.properties.notify || c.properties.indicate);
    const notify = notifyChars.find((c) => c.uuid.includes('ae02') || c.uuid.includes('af02')) || notifyChars[0];
    const data = chars.find((c) => c.uuid.includes('ae03') || c.uuid.includes('af03'));
    this.onLog(`service=${service.uuid} write=${write ? write.uuid : 'AUCUN'} notify=[${notifyChars.map((c) => c.uuid).join(', ')}] data=${data ? data.uuid : '-'}`);
    if (!write) throw new Error('aucune caractéristique d\'écriture trouvée sur ce service');
    return { write, notify, notifyChars, data };
  }

  disconnect() {
    if (this.connected) this.device.gatt.disconnect();
  }

  _onNotify(bytes) {
    this.onLog(`reçu ${hex(bytes)}`);
    const prev = this._rx || new Uint8Array(0);
    const buf = new Uint8Array(prev.length + bytes.length);
    buf.set(prev, 0);
    buf.set(bytes, prev.length);
    let offset = 0;
    while (offset + 8 <= buf.length) {
      const isCat = buf[offset] === 0x51 && buf[offset + 1] === 0x78;
      const isMxw = buf[offset] === 0x22 && buf[offset + 1] === 0x21;
      if (isCat || isMxw) {
        let end = -1;
        for (let i = offset + 6; i < buf.length; i++) {
          if (buf[i] === 0xff) { end = i; break; }
        }
        if (end === -1) break;
        this._handlePacket(buf.slice(offset, end + 1));
        offset = end + 1;
      } else {
        offset++;
      }
    }
    this._rx = buf.slice(offset);
  }

  _handlePacket(bytes) {
    const pkt = parsePacket(bytes);
    if (!pkt) return;
    this.onLog(`trame reçue : cmd=0x${pkt.cmd.toString(16).padStart(2, '0')} len=${pkt.len} crcOk=${pkt.crcOk}`);
    if (this.isMxw) {
      if (pkt.cmd === MXW.status) {
        const text = mxwStatusToText(pkt.payload);
        this.lastState = { text };
        this.lastBattery = pkt.payload.length > 3 ? pkt.payload[3] : null;
        this.onState(0, text);
      }
      if (pkt.cmd === MXW.version) {
        this.onLog(`version firmware : ${Array.from(pkt.payload).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')}`);
      }
    } else {
      if (pkt.cmd === CAT.lineControl) {
        const v = pkt.payload[0];
        if (v === 0x10) {
          this.paused = true;
          this.onLog('pause : tampon de l\'imprimante plein');
        } else if (v === 0x00) {
          this.paused = false;
          this._resumeWaiters.splice(0).forEach((r) => r());
          this.onLog('reprise du flux');
        }
      }
      if (pkt.cmd === CAT.getState) {
        const flags = pkt.payload[0] || 0;
        const text = stateToText(flags);
        this.lastState = { flags, text };
        this.onState(flags, text);
      }
    }
    const ws = this._cmdWaiters.get(pkt.cmd);
    if (ws && ws.length) {
      this._cmdWaiters.delete(pkt.cmd);
      ws.forEach((r) => r(pkt));
    }
  }

  _waitCmd(cmd, timeoutMs) {
    return new Promise((resolve) => {
      const ws = this._cmdWaiters.get(cmd) || [];
      ws.push(resolve);
      this._cmdWaiters.set(cmd, ws);
      setTimeout(() => {
        const arr = this._cmdWaiters.get(cmd);
        if (arr) {
          const i = arr.indexOf(resolve);
          if (i >= 0) arr.splice(i, 1);
          if (!arr.length) this._cmdWaiters.delete(cmd);
        }
        resolve(null);
      }, timeoutMs);
    });
  }

  _request(cmd, payload, timeoutMs) {
    const p = this._waitCmd(cmd, timeoutMs);
    this.send(cmd, payload).catch(() => {});
    return p;
  }

  async _waitIfPaused() {
    while (this.paused) {
      await new Promise((r) => this._resumeWaiters.push(r));
    }
  }

  async _writeTo(char, bytes) {
    await this._waitIfPaused();
    const CHUNK = 20;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const part = bytes.slice(i, i + CHUNK);
      if (char.properties.write) {
        await char.writeValue(part);
      } else {
        await char.writeValueWithoutResponse(part);
      }
      if (i + CHUNK < bytes.length) await sleep(12);
    }
  }

  async send(cmd, payload) {
    if (!this.connected) throw new Error('imprimante non connectée');
    const pkt = buildPacket(cmd, payload, this.header);
    this.onLog(`envoi ${hex(pkt)}`);
    await this._writeTo(this.writeChar, pkt);
  }

  async getState(timeoutMs = 3000) {
    if (this.isMxw) {
      let resp = await this._request(MXW.status, Uint8Array.from([0x00]), 2500);
      if (!resp) resp = await this._request(MXW.status, Uint8Array.from([0x00]), 2500);
      return resp ? { text: mxwStatusToText(resp.payload) } : null;
    }
    const resp = await this._request(CAT.getState, Uint8Array.from([0x00]), timeoutMs);
    if (!resp) return null;
    const flags = resp.payload[0] || 0;
    return { flags, text: stateToText(flags) };
  }

  async cancel() {
    if (this.isMxw) {
      await this.send(MXW.cancel, Uint8Array.from([0x00]));
    } else {
      this.onLog('annulation (AC) non documentée sur ce modèle cat classique');
    }
  }

  async getInfo(timeoutMs = 2500) {
    if (!this.isMxw) return null;
    const v = await this._request(MXW.version, Uint8Array.from([0x00]), timeoutMs);
    const t = await this._request(MXW.printType, Uint8Array.from([0x00]), timeoutMs);
    const c = await this._request(MXW.queryCount, Uint8Array.from([0x00]), timeoutMs);
    return {
      version: v && v.payload.length ? new TextDecoder().decode(v.payload).replace(/\0+$/, '') : null,
      type: t && t.payload.length ? t.payload[0] : null,
      count: c && c.payload.length ? Array.from(c.payload) : null,
    };
  }

  startStatusPolling(intervalMs = 30000) {
    this.stopStatusPolling();
    this._pollTimer = setInterval(() => {
      if (this.connected) this.getState(3000).catch(() => {});
    }, intervalMs);
  }

  stopStatusPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async feed(steps = 50) {
    if (this.isMxw) {
      await this.send(MXW.feed, Uint8Array.from([steps & 0xff, (steps >> 8) & 0xff]));
    } else {
      await this.send(CAT.feed, Uint8Array.from([steps & 0xff]));
    }
  }

  async printLines(lines, opts = {}) {
    if (!this.connected) throw new Error('imprimante non connectée');
    if (!lines.length) throw new Error('rien à imprimer');
    return this.isMxw ? this._printMxw(lines, opts) : this._printCat(lines, opts);
  }

  async _printMxw(lines, opts) {
    const energy = opts.energy ?? 0xc000;
    const intensity = Math.max(0, Math.min(100, Math.round((energy / 65535) * 100)));
    const feedLines = opts.feed ?? 50;
    const mode = opts.mode ?? 0;
    const bytesPerRow = mode === 2 ? 192 : LINE_BYTES;
    const st = await this.getState(2000);
    this.onLog(`état avant impression : ${st ? st.text : 'inconnu (pas de réponse A1)'}`);
    await this.send(MXW.intensity, Uint8Array.from([intensity]));
    await sleep(100);
    const height = lines.length;
    const ackPromise = this._waitCmd(MXW.printRequest, 3000);
    await this.send(MXW.printRequest, Uint8Array.from([height & 0xff, (height >> 8) & 0xff, bytesPerRow & 0xff, mode]));
    const ack = await ackPromise;
    this.onLog(`ack A9 : ${ack ? (ack.payload[0] === 0 ? 'OK (00)' : `refusé (${hex(ack.payload)})`) : 'aucune réponse (timeout)'}`);
    if (ack && ack.payload[0] !== 0) throw new Error('l\'imprimante a refusé la demande d\'impression (A9)');
    const data = new Uint8Array(lines.length * bytesPerRow);
    lines.forEach((l, i) => data.set(l, i * bytesPerRow));
    this.onLog(`envoi de ${data.length} octets de données image sur ${this.dataChar.uuid} (${lines.length} lignes de ${bytesPerRow} octets, mode ${mode})`);
    await this._writeTo(this.dataChar, data);
    await this.send(MXW.flush, Uint8Array.from([0x00]));
    const done = await this._waitCmd(MXW.printComplete, 60000);
    this.onLog(done ? 'impression terminée (AA reçu)' : 'pas de AA reçu — l\'impression a peut-être quand même réussi');
    await sleep(300);
    await this.send(MXW.feed, Uint8Array.from([feedLines & 0xff, (feedLines >> 8) & 0xff]));
    return lines.length;
  }

  async _printCat(lines, opts) {
    const energy = opts.energy ?? 0xc000;
    const quality = opts.quality ?? 0x33;
    const feed = opts.feed ?? 50;
    const chunkLines = opts.chunkLines ?? 4;
    const chunkDelayMs = opts.chunkDelayMs ?? 40;
    const state = await this.getState();
    if (state && state.flags & STATE.noPaper) throw new Error('pas de papier ou capot ouvert');
    await this.send(CAT.setQuality, Uint8Array.from([quality]));
    await sleep(80);
    await this.send(CAT.lattice, LATTICE_START);
    await sleep(80);
    await this.send(CAT.setEnergy, Uint8Array.from([energy & 0xff, (energy >> 8) & 0xff]));
    await sleep(80);
    await this.send(CAT.feedSpeed, Uint8Array.from([0x00]));
    await sleep(80);
    await this.send(CAT.drawMode, Uint8Array.from([0x00]));
    await sleep(80);
    for (let i = 0; i < lines.length; i++) {
      await this.send(CAT.drawLine, lines[i]);
      if ((i + 1) % chunkLines === 0) await sleep(chunkDelayMs);
    }
    await sleep(150);
    await this.send(CAT.lattice, LATTICE_END);
    await sleep(100);
    await this.send(CAT.feed, Uint8Array.from([feed & 0xff]));
    return lines.length;
  }
}
