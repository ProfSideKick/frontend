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

  // Android-only amplification of the AI *output*, never the microphone.
  // Native WebRTC playback remains available if Web Audio is unsupported or blocked.
  let activeAudioContext: AudioContext | null = null;
  const releaseAudioContext = () => {
    const context = activeAudioContext;
    activeAudioContext = null;
    if (context) void context.close().catch(() => {});
  };
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "closed" || pc.connectionState === "failed") {
      releaseAudioContext();
    }
  });

  pc.ontrack = (e) => {
    const element = audioElement.current;
    const originalStream = e.streams[0];
    if (!element || !originalStream) return;

    releaseAudioContext();
    element.srcObject = originalStream;
    if (!/Android/i.test(navigator.userAgent) || typeof AudioContext === "undefined") return;

    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const source = context.createMediaStreamSource(originalStream);
      const boost = context.createGain();
      boost.gain.value = 1.8; // +5.1 dB on quiet speech before compression
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 0;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      const outputGain = context.createGain();
      outputGain.gain.value = 0.9; // post-compression headroom, not device volume
      const destination = context.createMediaStreamDestination();
      source.connect(boost);
      boost.connect(limiter);
      limiter.connect(outputGain);
      outputGain.connect(destination);
      activeAudioContext = context;

      const activateBoost = () => {
        if (activeAudioContext !== context || context?.state !== "running" ||
            audioElement.current !== element || element.srcObject !== originalStream ||
            pc.connectionState === "closed") return;
        element.srcObject = destination.stream;
        // If browser autoplay is blocked, restore native playback.
        if (element.paused) {
          void element.play().catch(() => {
            if (activeAudioContext === context) {
              if (element.srcObject === destination.stream) element.srcObject = originalStream;
              releaseAudioContext();
            }
          });
        }
      };
      if (context.state === "running") activateBoost();
      else void context.resume().then(activateBoost).catch(() => {
        if (activeAudioContext === context) releaseAudioContext();
      });
    } catch (error) {
      console.warn("Android output amplification unavailable; retaining native audio", error);
      if (context) void context.close().catch(() => {});
      activeAudioContext = null;
      element.srcObject = originalStream;
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
