// Reusable React hooks for call views — subscribes to engine without coupling to provider.

import { useEffect, useState, useCallback } from "react";
import { getCallEngine } from "@/engine/call-engine";
import type { CallEngineState, CallEngineEvent } from "@/engine/types";

export function useCallView(userId: string) {
  const [state, setState] = useState<CallEngineState | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const engine = getCallEngine({ userId });
    const currentState = engine.getState();

    setState(currentState);
    setIsRinging(currentState.state === "ringing");
    setIsActive(currentState.state === "active");

    const unsubscribe = engine.subscribe((event: CallEngineEvent) => {
      if (event.type === "state-change") {
        const newState = event.payload as CallEngineState;
        setState(newState);
        setIsRinging(newState.state === "ringing");
        setIsActive(newState.state === "active");
      }
    });

    return unsubscribe;
  }, [userId]);

  const acceptIncomingCall = useCallback(
    async (video: boolean) => {
      try {
        const engine = getCallEngine({ userId });
        await engine.acceptCall(video);
      } catch (error) {
        console.error("[useCallView] Error accepting call:", error);
      }
    },
    [userId],
  );

  const declineIncomingCall = useCallback(() => {
    const engine = getCallEngine({ userId });
    engine.declineCall();
  }, [userId]);

  const endActiveCall = useCallback(() => {
    const engine = getCallEngine({ userId });
    engine.endCall();
  }, [userId]);

  const toggleAudio = useCallback((enabled: boolean) => {
    const engine = getCallEngine({ userId });
    engine.setAudioEnabled(enabled);
  }, [userId]);

  const toggleVideo = useCallback((enabled: boolean) => {
    const engine = getCallEngine({ userId });
    engine.setVideoEnabled(enabled);
  }, [userId]);

  return {
    state,
    isRinging,
    isActive,
    acceptIncomingCall,
    declineIncomingCall,
    endActiveCall,
    toggleAudio,
    toggleVideo,
  };
}
