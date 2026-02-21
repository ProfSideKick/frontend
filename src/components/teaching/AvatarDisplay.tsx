"use client";

import { useEffect, useRef } from "react";
import {TalkingHead} from "../AvatarIntegration/talkinghead.mjs";
import {LipsyncEn} from "../AvatarIntegration/lipsync-en.mjs";

export default function AvatarDisplay({ onReady }: { onReady?: (th: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<any>(null);

  // AvatarDisplay.tsx

  useEffect(() => {
    // Dev-only guard against StrictMode double-mounts
    if (process.env.NODE_ENV === "development") {
      const w = window as any;
      if (w.__TalkingHeadInitInProgress) {
        console.log("TalkingHead init already in progress (dev guard) — skipping duplicate init.");
        return;
      }
      w.__TalkingHeadInitInProgress = true;
    }
  
    if (headRef.current) return;
    if (!containerRef.current) return;

    // Hard guarantee: start from an empty container so we never end up with
    // multiple canvases even if something previously rendered into it.
    containerRef.current.innerHTML = "";
  
    const th = new TalkingHead(containerRef.current, { 
      lipsyncModule: LipsyncEn,
      cameraView: "head",           // default to the closest framing
      cameraRotateEnable: false,    // keep camera steady
      cameraZoomEnable: false,
      cameraPanEnable: false,
      modelPixelRatio: 1.5          // render at higher pixel density for sharper image
    });
    headRef.current = th;
    onReady?.(th);
  
    requestAnimationFrame(async () => {
      console.log("[DEBUG][AVATAR DISPLAY] showAvatar() loading brunette.glb…");
      await th.showAvatar({ url: "/avatars/brunette.glb" } as any);
      console.log("[DEBUG][AVATAR DISPLAY] Avatar loaded successfully");

      // Force the camera to stay tight on the upper body after the model loads.
      th.setView("head", {
        cameraDistance: 2.1,   // even closer to the face
        cameraY: 0.62,         // bias upward to crop out legs
        cameraX: 0
      });
    });
  
    return () => {
      try { th.dispose(); } catch {}
  
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
  
      headRef.current = null;
  
      if (process.env.NODE_ENV === "development") {
        (window as any).__TalkingHeadInitInProgress = false;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: 420,
        height: 520,
        borderRadius: 16,
        overflow: "hidden"
      }}
    />
  );
}
