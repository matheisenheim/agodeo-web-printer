import {
  SERVICE_UUID,
  CMD,
  LATTICE_START,
  LATTICE_END,
  STATE,
  buildPacket,
  parsePacket,
  stateToText,
  hex,
} from './protocol.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CatPrinter {
  constructor() {
    this.device = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.paused = false;
    this.lastState = null;
    this.onLog = () => {};
    this.onState = () => {};
    this.onDisconnect = () => {};
    this._resumeWaiters = [];
    this._stateSeq = 0;
    this._rx = new Uint8Array(0);
  }

  get connected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  async connect(namePrefix = '') {
    const options = namePrefix
      ? { filters: [{ namePrefix }], optionalServices: [SERVICE_UUID] }
      : { acceptAllDevices: true, optionalServices: [SERVICE_UUID] };
    this.device = await navigator.bluetooth.requestDevice(options);
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());
    const server = await this._connectGattWithRetry();
    const channel = await this._findChannel(server);
    this.writeChar = channel.write;
    this.notifyChar = channel.notify;
    if (this.notifyChar) {
      await this.notifyChar.startNotifications();
      this.notifyChar.addEventListener('characteristicvaluechanged', (e) => {
        this._onNotify(new Uint8Array(e.target.value.buffer, e.target.value.byteOffset, e.target.value.byteLength));
      });
    }
    this.onLog(`connecté à ${this.device.name || this.device.id}`);
    if (this.notifyChar) {
      await this.send(CMD.getInfo, Uint8Array.from([0x00]));
      await sleep(300);
      await this.send(CMD.lineControl, Uint8Array.from([0x00]));
      await sleep(100);
      await this.send(CMD.getState, Uint8Array.from([0x00]));
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
    const write = chars.find((c) => c.uuid.includes('ae01'))
      || chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    const notify = chars.find((c) => c.uuid.includes('ae02'))
      || chars.find((c) => c.properties.notify || c.properties.indicate);
    return { write, notify };
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
      if (buf[offset] === 0x51 && buf[offset + 1] === 0x78) {
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
    if (pkt.cmd === CMD.lineControl) {
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
    if (pkt.cmd === CMD.getState) {
      const flags = pkt.payload[0] || 0;
      this.lastState = { flags, text: stateToText(flags) };
      this._stateSeq += 1;
      this.onState(flags, this.lastState.text);
    }
    if (pkt.cmd === CMD.getInfo) {
      this.onLog(`infos appareil : ${hex(pkt.payload)}`);
    }
  }

  async _waitIfPaused() {
    while (this.paused) {
      await new Promise((r) => this._resumeWaiters.push(r));
    }
  }

  async _write(bytes) {
    await this._waitIfPaused();
    if (this.writeChar.properties.writeWithoutResponse) {
      await this.writeChar.writeValueWithoutResponse(bytes);
    } else {
      await this.writeChar.writeValue(bytes);
    }
  }

  async send(cmd, payload) {
    if (!this.connected) throw new Error('imprimante non connectée');
    const pkt = buildPacket(cmd, payload);
    this.onLog(`envoi ${hex(pkt)}`);
    await this._write(pkt);
  }

  async getState(timeoutMs = 3000) {
    const before = this._stateSeq;
    await this.send(CMD.getState, Uint8Array.from([0x00]));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this._stateSeq > before) return this.lastState;
      await sleep(50);
    }
    return null;
  }

  async feed(steps = 50) {
    await this.send(CMD.feed, Uint8Array.from([steps & 0xff]));
  }

  async printLines(lines, opts = {}) {
    if (!this.connected) throw new Error('imprimante non connectée');
    const energy = opts.energy ?? 0xc000;
    const quality = opts.quality ?? 0x33;
    const feed = opts.feed ?? 50;
    const chunkLines = opts.chunkLines ?? 4;
    const chunkDelayMs = opts.chunkDelayMs ?? 40;
    if (!lines.length) throw new Error('rien à imprimer');
    const state = await this.getState();
    if (state && (state.flags & STATE.noPaper)) throw new Error('pas de papier ou capot ouvert');
    await this.send(CMD.setQuality, Uint8Array.from([quality]));
    await this.send(CMD.lattice, LATTICE_START);
    await this.send(CMD.setEnergy, Uint8Array.from([energy & 0xff, (energy >> 8) & 0xff]));
    await this.send(CMD.feedSpeed, Uint8Array.from([0x00]));
    await this.send(CMD.drawMode, Uint8Array.from([0x00]));
    for (let i = 0; i < lines.length; i++) {
      await this.send(CMD.drawLine, lines[i]);
      if ((i + 1) % chunkLines === 0) await sleep(chunkDelayMs);
    }
    await sleep(150);
    await this.send(CMD.lattice, LATTICE_END);
    await sleep(100);
    await this.send(CMD.feed, Uint8Array.from([feed & 0xff]));
    return lines.length;
  }
}
