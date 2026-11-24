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

function setup({ android = true, devices = [], enumerateError, switchError, sdpError = false, AudioContextClass, audioPaused = false, audioPlayReject = false } = {}) {
  const original = mkStream('default-mic');
  const preferred = mkStream('spk');
  const calls = [];
  const peer = {
    sent: [], closed: false, connectionState: 'connected', listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    emitState(state) { this.connectionState = state; this.listeners.connectionstatechange?.(); },
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
  const audio = { current: {
    srcObject: null, muted: true, paused: audioPaused,
    play() { return audioPlayReject ? Promise.reject(Error('autoplay blocked')) : Promise.resolve(); },
  } };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports,
    navigator: { userAgent: android ? 'Android Chrome' : 'Macintosh Chrome', mediaDevices },
    window: { location: { protocol: 'https:', hostname: 'test.example' }, RTCPeerConnection: function() {} },
    RTCPeerConnection: function() { return peer; },
    RTCRtpSender: { getCapabilities: () => null },
    console: { log() {}, warn() {} },
    AudioContext: AudioContextClass,
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


function fakeWebAudio({ initialState = 'running', constructionFails = false, resumeRejects = false } = {}) {
  const contexts = [];
  class FakeAudioContext {
    constructor() {
      if (constructionFails) throw Error('Web Audio unavailable');
      this.state = initialState;
      this.closed = false;
      this.nodes = [];
      contexts.push(this);
    }
    node(name, extra = {}) {
      const result = { name, ...extra, connectedTo: null, connect(dest) { this.connectedTo = dest; } };
      this.nodes.push(result);
      return result;
    }
    createMediaStreamSource(stream) { return this.node('source', { stream }); }
    createGain() { return this.node('gain', { gain: { value: 1 } }); }
    createDynamicsCompressor() {
      return this.node('compressor', {
        threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
        attack: { value: 0 }, release: { value: 0 },
      });
    }
    createMediaStreamDestination() { return this.node('destination', { stream: { boosted: true } }); }
    async resume() {
      if (resumeRejects) throw Error('Autoplay denied');
      this.state = 'running';
    }
    async close() { this.closed = true; this.state = 'closed'; }
  }
  return { AudioContextClass: FakeAudioContext, contexts };
}
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const aiSpeech = { id: 'remote-ai-voice' };

test('Android: boosts only AI output and keeps microphone and mute behavior', async () => {
  const wa = fakeWebAudio();
  const s = setup({ AudioContextClass: wa.AudioContextClass });
  const { mediaStream } = await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  const ctx = wa.contexts[0];
  assert.equal(ctx.nodes[0].stream, aiSpeech);
  assert.equal(ctx.nodes[1].gain.value, 1.8);
  assert.equal(ctx.nodes[2].threshold.value, -10);
  assert.equal(ctx.nodes[2].ratio.value, 12);
  assert.equal(ctx.nodes[3].gain.value, 0.9);
  assert.equal(ctx.nodes[0].connectedTo, ctx.nodes[1]);
  assert.equal(ctx.nodes[1].connectedTo, ctx.nodes[2]);
  assert.equal(ctx.nodes[2].connectedTo, ctx.nodes[3]);
  assert.equal(ctx.nodes[3].connectedTo, ctx.nodes[4]);
  assert.equal(s.audio.current.srcObject, ctx.nodes[4].stream);
  assert.equal(s.audio.current.muted, true);
  assert.equal(s.peer.sent[0], mediaStream.track);
});

test('Non-Android preserves the unprocessed WebRTC stream', async () => {
  const wa = fakeWebAudio();
  const s = setup({ android: false, AudioContextClass: wa.AudioContextClass });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  assert.equal(s.audio.current.srcObject, aiSpeech);
  assert.equal(wa.contexts.length, 0);
});

test('Android without Web Audio keeps native output', async () => {
  const s = setup();
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  assert.equal(s.audio.current.srcObject, aiSpeech);
});

test('Web Audio construction failure keeps native output', async () => {
  const wa = fakeWebAudio({ constructionFails: true });
  const s = setup({ AudioContextClass: wa.AudioContextClass });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  assert.equal(s.audio.current.srcObject, aiSpeech);
});

test('AudioContext resume failure leaves original audio and closes processing', async () => {
  const wa = fakeWebAudio({ initialState: 'suspended', resumeRejects: true });
  const s = setup({ AudioContextClass: wa.AudioContextClass });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  await nextTurn();
  assert.equal(s.audio.current.srcObject, aiSpeech);
  assert.equal(wa.contexts[0].closed, true);
});

test('Autoplay rejection restores original audio and closes processing', async () => {
  const wa = fakeWebAudio();
  const s = setup({ AudioContextClass: wa.AudioContextClass, audioPaused: true, audioPlayReject: true });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  await nextTurn();
  assert.equal(s.audio.current.srcObject, aiSpeech);
  assert.equal(wa.contexts[0].closed, true);
});

test('WebRTC disconnection closes the audio context', async () => {
  const wa = fakeWebAudio();
  const s = setup({ AudioContextClass: wa.AudioContextClass });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  s.peer.emitState('closed');
  await nextTurn();
  assert.equal(wa.contexts[0].closed, true);
});

test('Repeated ontrack events do not leave duplicate audio contexts', async () => {
  const wa = fakeWebAudio();
  const s = setup({ AudioContextClass: wa.AudioContextClass });
  await s.createRealtimeConnection('key', s.audio, 'opus');
  s.peer.ontrack({ streams: [aiSpeech] });
  const newerStream = { id: 'new-ai-voice' };
  s.peer.ontrack({ streams: [newerStream] });
  await nextTurn();
  assert.equal(wa.contexts[0].closed, true);
  assert.equal(wa.contexts.length, 2);
  assert.equal(s.audio.current.srcObject, wa.contexts[1].nodes[4].stream);
});
