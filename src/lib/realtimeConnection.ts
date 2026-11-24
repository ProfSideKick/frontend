import { RefObject } from "react";

// Check if the environment supports getUserMedia
export function checkWebRTCSupport(): { supported: boolean; error?: string } {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, error: 'Not running in browser environment' };
  }

  // Check for HTTPS (required for getUserMedia in modern browsers)
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return { 
      supported: false, 
      error: 'HTTPS is required for microphone access. Please use a secure connection.' 
    };
  }

  // Check for getUserMedia support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { 
      supported: false, 
      error: 'getUserMedia is not supported in this browser. Please use a modern browser.' 
    };
  }

  // Check for WebRTC support
  if (!window.RTCPeerConnection) {
    return { 
      supported: false, 
      error: 'WebRTC is not supported in this browser. Please use a modern browser.' 
    };
  }

  return { supported: true };
}

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>,
  codec: string,
  model: string = "gpt-realtime"
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel; mediaStream: MediaStream }> {
  // Check WebRTC support first
  const supportCheck = checkWebRTCSupport();
  if (!supportCheck.supported) {
    throw new Error(supportCheck.error || 'WebRTC not supported');
  }

  // Create a new RTCPeerConnection
  const pc = new RTCPeerConnection();

  // Native WebRTC audio is ALWAYS kept. Android may supplement it with a
  // separate boost output; failure in that path cannot silence native playback.
  let boostedContext: AudioContext | null = null;
  let boostedClone: MediaStream | null = null;
  let unsubscribeVolume: (() => void) | null = null;
  const disposeBoost = () => {
    unsubscribeVolume?.();
    unsubscribeVolume = null;
    boostedClone?.getTracks().forEach(t => t.stop());
    boostedClone = null;
    const old = boostedContext;
    boostedContext = null;
    if (old) void old.close().catch(() => {});
  };
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "closed" || pc.connectionState === "failed")
      disposeBoost();
  });

  pc.ontrack = e => {
    const element = audioElement.current;
    const original = e.streams[0];
    if (!element || !original) return;
    disposeBoost();

    // This must never be swapped for a processed stream (PR #6 regression).
    element.srcObject = original;
    if (!/Android/i.test(navigator.userAgent) || typeof AudioContext === "undefined")
      return;

    let context: AudioContext | null = null;
    let clone: MediaStream | null = null;
    try {
      clone = original.clone();
      context = new AudioContext();
      const source = context.createMediaStreamSource(clone);
      const boost = context.createGain();
      boost.gain.value = 1.6;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 0;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      const overlay = context.createGain();
      const syncMute = () => {
        overlay.gain.value = element.muted ? 0 : 0.5 * element.volume;
      };
      syncMute();
      source.connect(boost);
      boost.connect(compressor);
      compressor.connect(overlay);
      overlay.connect(context.destination);

      // The existing mute button controls both paths, with NO UI changes.
      element.addEventListener("volumechange", syncMute);
      unsubscribeVolume = () => element.removeEventListener("volumechange", syncMute);
      boostedContext = context;
      boostedClone = clone;
      if (context.state !== "running") {
        void context.resume().catch(() => {
          if (boostedContext === context) disposeBoost();
        });
      }
    } catch (err) {
      console.warn("Android boost unavailable: native WebRTC audio retained", err);
      if (context) void context.close().catch(() => {});
      clone?.getTracks().forEach(t => t.stop());
    }
  };

  // Start with the system default. Android may expose a separate speakerphone
  // communication input; selecting it can switch the paired output to loudspeaker.
  // Never select a headset and never fail the session because routing fails.
  let mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (/Android/i.test(navigator.userAgent) && navigator.mediaDevices.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const speakerphone = devices.find((device) =>
        device.kind === "audioinput" &&
        /speakerphone/i.test(device.label) &&
        !/headset|headphone|bluetooth/i.test(device.label) &&
        device.deviceId
      );
      const currentId = mediaStream.getAudioTracks()[0]?.getSettings().deviceId;
      if (speakerphone && speakerphone.deviceId !== currentId) {
        try {
          const preferred = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: speakerphone.deviceId } },
          });
          if (preferred.getAudioTracks().length) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = preferred;
          } else {
            preferred.getTracks().forEach((track) => track.stop());
          }
        } catch (error) {
          console.warn("Speakerphone route unavailable; retaining default audio", error);
        }
      }
    } catch (error) {
      console.warn("Could not inspect Android audio routes; retaining default audio", error);
    }
  }
  pc.addTrack(mediaStream.getAudioTracks()[0]);

  // Set codec preferences based on selected codec from the query parameter.
  const capabilities = RTCRtpSender.getCapabilities("audio");
  if (capabilities) {
    const chosenCodec = capabilities.codecs.find(
      (c) => c.mimeType.toLowerCase() === `audio/${codec}`
    );
    if (chosenCodec) {
      pc.getTransceivers()[0].setCodecPreferences([chosenCodec]);
    } else {
      console.warn(
        `Codec "${codec}" not found in capabilities. Using default settings.`
      );
    }
  }

  // Create a data channel for communication with the server
  const dc = pc.createDataChannel("oai-events");

  // Create an offer for the connection
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // GA Realtime WebRTC endpoint. The model comes from the session baked into the
  // ephemeral client secret, so no ?model= query param is sent.
  const callsUrl = "https://api.openai.com/v1/realtime/calls";
  console.log(`🤖 Using model (from client secret session): ${model}`);

  const sdpResponse = await fetch(callsUrl, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  const answerSdp = await sdpResponse.text();
  if (!sdpResponse.ok) {
    mediaStream.getTracks().forEach((t) => t.stop());
    pc.close();
    let message = answerSdp;
    try {
      message = JSON.parse(answerSdp)?.error?.message || answerSdp;
    } catch {
      /* body was not JSON */
    }
    throw new Error(`OpenAI Realtime call setup failed (${sdpResponse.status}): ${message}`);
  }
  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: answerSdp,
  };

  await pc.setRemoteDescription(answer);

  return { pc, dc, mediaStream };
}
