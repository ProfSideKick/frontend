const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/realtimeConnection.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function mkStream(id) {
  const track = { stopped: false, getSettings: () => ({ deviceId: id }), stop() { this.stopped = true; } };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}

function setup({ android = true, devices = [], enumerateError, switchError, sdpError = false } = {}) {
  const original = mkStream('default-mic');
  const preferred = mkStream('spk');
  const calls = [];
  const peer = {
    sent: [], closed: false,
    addTrack(track) { this.sent.push(track); },
    createDataChannel: () => ({ readyState: 'open' }),
    createOffer: async () => ({ sdp: 'offer' }),
    setLocalDescription: async () => {},
    setRemoteDescription: async () => {},
    close() { this.closed = true; },
  };
  const mediaDevices = {
    getUserMedia: async (opts) => {
      calls.push(opts);
      if (calls.length === 1) return original;
      if (switchError) throw Error('device unavailable');
      return preferred;
    },
    enumerateDevices: async () => {
      if (enumerateError) throw Error('enumeration failed');
      return devices;
    },
  };
  const audio = { current: { srcObject: null } };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports,
    navigator: { userAgent: android ? 'Android Chrome' : 'Macintosh Chrome', mediaDevices },
    window: { location: { protocol: 'https:', hostname: 'test.example' }, RTCPeerConnection: function() {} },
    RTCPeerConnection: function() { return peer; },
    RTCRtpSender: { getCapabilities: () => null },
    console: { log() {}, warn() {} },
    fetch: async () => ({ status: sdpError ? 502 : 200, ok: !sdpError, text: async () => 'answer' }),
  };
  vm.runInNewContext(js, context);
  return { ...module.exports, original, preferred, peer, calls, audio };
}

const spk = { kind: 'audioinput', label: 'Speakerphone', deviceId: 'spk' };

test('Android selects labeled speakerphone and releases default mic', async () => {
  const s = setup({ devices: [spk] });
  const { mediaStream } = await s.createRealtimeConnection('key', s.audio, 'opus');
  assert.equal(mediaStream, s.preferred);
  assert.equal(s.peer.sent[0], s.preferred.track);
  assert.equal(s.original.track.stopped, true);
  assert.equal(s.calls.length, 2);
});

test('Android with no speakerphone label keeps default mic', async () => {
  const s = setup({ devices: [{ kind: 'audioinput', label: 'Internal mic', deviceId: 'internal' }] });
  const { mediaStream } = await s.createRealtimeConnection('key', s.audio, 'opus');
  assert.equal(mediaStream, s.original);
  assert.equal(s.calls.length, 1);
  assert.equal(s.original.track.stopped, false);
});

test('Android never switches to a Bluetooth headset', async () => {
  const s = setup({ devices: [{ kind: 'audioinput', label: 'Bluetooth Headset Speakerphone', deviceId: 'spk' }] });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  assert.equal(s.calls.length, 1);
});

test('Android preferred-mic failure falls back to original', async () => {
  const s = setup({ devices: [spk], switchError: true });
  const { mediaStream } = await s.createRealtimeConnection('key', s.audio, 'opus');
  assert.equal(mediaStream, s.original);
  assert.equal(s.original.track.stopped, false);
});

test('Android enumeration failure retains original', async () => {
  const s = setup({ enumerateError: true });
  const { mediaStream } = await s.createRealtimeConnection('key', s.audio, 'opus');
  assert.equal(mediaStream, s.original);
  assert.equal(s.calls.length, 1);
});

test('Non-Android retains original route', async () => {
  const s = setup({ android: false, devices: [spk] });
  const { mediaStream } = await s.createRealtimeConnection('key', s.audio, 'opus');
  assert.equal(mediaStream, s.original);
  assert.equal(s.calls.length, 1);
});

test('WebRTC failure cleans up preferred mic and peer connection', async () => {
  const s = setup({ devices: [spk], sdpError: true });
  await assert.rejects(s.createRealtimeConnection('key', s.audio, 'opus'), /502/);
  assert.equal(s.preferred.track.stopped, true);
  assert.equal(s.peer.closed, true);
});
