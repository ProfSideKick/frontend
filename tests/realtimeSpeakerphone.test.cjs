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
  const events = {};
  const audio = { current: {
    srcObject: null, muted: false, volume: 1, paused: audioPaused,
    addEventListener(name, fn) { events[name] = fn; },
    removeEventListener(name, fn) { if(events[name]===fn) delete events[name]; },
    toggleMuted(muted) { this.muted = muted; events.volumechange?.(); },
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


function fakeWebAudio({failConstructor=false,failSource=false,suspended=false,failResume=false}={}) {
  const contexts=[];
  class FakeContext {
    constructor(){
      if(failConstructor) throw Error('blocked');
      this.nodes=[]; this.destination={name:'speaker'};
      this.closed=false; this.state=suspended?'suspended':'running'; contexts.push(this);
    }
    node(kind,props={}){
      const node={kind,...props,connected:null,connect(dest){this.connected=dest;}};
      this.nodes.push(node); return node;
    }
    createMediaStreamSource(stream) {
      if(failSource) throw Error('bad source');
      return this.node('source',{stream});
    }
    createGain(){return this.node('gain',{gain:{value:1}});}
    createDynamicsCompressor(){
      return this.node('compressor',{threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}});
    }
    createMediaStreamDestination(){throw Error('Processed stream replacement is forbidden');}
    async resume(){if(failResume)throw Error('autoplay');this.state='running';}
    async close(){this.closed=true;this.state='closed';}
  }
  return {AudioContextClass:FakeContext,contexts};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function remote(){
  const track={stopped:false,stop(){this.stopped=true}};
  const clone={getTracks:()=>[track]};
  const original={clone:()=>clone,getTracks:()=>[{stop(){throw Error('native stream stopped')}}]};
  return {original,clone,track};
}
test('Android preserves native WebRTC stream while adding a direct amplified path',async()=>{
  const wa=fakeWebAudio(),s=setup({AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  const c=wa.contexts[0];
  assert.equal(s.audio.current.srcObject,r.original);
  assert.equal(s.audio.current.muted,false);
  assert.equal(c.nodes[0].stream,r.clone);
  assert.equal(c.nodes[1].gain.value,1.6);
  assert.equal(c.nodes[2].threshold.value,-12);
  assert.equal(c.nodes[2].ratio.value,12);
  assert.equal(c.nodes[3].gain.value,.5);
  assert.equal(c.nodes[0].connected,c.nodes[1]);
  assert.equal(c.nodes[1].connected,c.nodes[2]);
  assert.equal(c.nodes[2].connected,c.nodes[3]);
  assert.equal(c.nodes[3].connected,c.destination);
  assert.equal(r.track.stopped,false);
});
test('Original mute button mutes the boost, then restores it without changing native stream',async()=>{
  const wa=fakeWebAudio(),s=setup({AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  const gain=wa.contexts[0].nodes[3].gain;
  s.audio.current.toggleMuted(true);
  assert.equal(gain.value,0);
  s.audio.current.toggleMuted(false);
  assert.equal(gain.value,.5);
  assert.equal(s.audio.current.srcObject,r.original);
});
test('Non-Android uses original sound with no added graph',async()=>{
  const wa=fakeWebAudio(),s=setup({android:false,AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  assert.equal(s.audio.current.srcObject,r.original);
  assert.equal(wa.contexts.length,0);
});
test('Web Audio unavailable retains original stream',async()=>{
  const s=setup(),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  assert.equal(s.audio.current.srcObject,r.original);
  assert.equal(r.track.stopped,false);
});
test('Context construction failure never stops native audio',async()=>{
  const wa=fakeWebAudio({failConstructor:true}),s=setup({AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  assert.equal(s.audio.current.srcObject,r.original);
  assert.equal(r.track.stopped,true);
});
test('Graph setup error cleans up clone without muting original',async()=>{
  const wa=fakeWebAudio({failSource:true}),s=setup({AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  await settle();
  assert.equal(s.audio.current.srcObject,r.original);
  assert.equal(r.track.stopped,true);
  assert.equal(wa.contexts[0].closed,true);
});
test('AudioContext resume rejection leaves native audio playing',async()=>{
  const wa=fakeWebAudio({suspended:true,failResume:true}),s=setup({AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  await settle();
  assert.equal(s.audio.current.srcObject,r.original);
  assert.equal(s.audio.current.muted,false);
  assert.equal(wa.contexts[0].closed,true);
});
test('Disconnect cleans overlay without destroying native audio stream',async()=>{
  const wa=fakeWebAudio(),s=setup({AudioContextClass:wa.AudioContextClass}),r=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r.original]});
  s.peer.emitState('closed');
  await settle();
  assert.equal(r.track.stopped,true);
  assert.equal(wa.contexts[0].closed,true);
  assert.equal(s.audio.current.srcObject,r.original);
});
test('Repeated incoming tracks clean the old boost and retain the new native stream',async()=>{
  const wa=fakeWebAudio(),s=setup({AudioContextClass:wa.AudioContextClass}),r1=remote(),r2=remote();
  await s.createRealtimeConnection('key',s.audio,'opus');
  s.peer.ontrack({streams:[r1.original]});s.peer.ontrack({streams:[r2.original]});
  await settle();
  assert.equal(r1.track.stopped,true);
  assert.equal(wa.contexts[0].closed,true);
  assert.equal(s.audio.current.srcObject,r2.original);
  assert.equal(wa.contexts.length,2);
});
