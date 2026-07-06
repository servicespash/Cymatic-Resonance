// React hooks that subscribe to the call engine.

import { useEffect, useState, useCallback, useRef } from "react";
import { getCallEngine, createCallEngine } from "@/engine/call-engine";
import type { CallEngineState, CallEngineEvent } from "@/engine/types";

export function useCallEngineState(): CallEngineState {
  const [state, setState] = useState<CallEngineState>(() => {
    return getCallEngine({ userId: "" }).getState();
  });

  useEffect(() => {
    const engine = getCallEngine({ userId: "" });
    const unsubscribe = engine.subscribe((event: CallEngineEvent) => {
      if (event.type === "state-change") {
        setState(event.payload as CallEngineState);
      }
    });

    return unsubscribe;
  }, []);

  return state;
}

export function useCallEngine(userId: string) {
  const engineRef = useRef(getCallEngine({ userId }));
  const [state, setState] = useState<CallEngineState>(() => engineRef.current.getState());

  useEffect(() => {
    const engine = engineRef.current;
    const unsubscribe = engine.subscribe((event: CallEngineEvent) => {
      if (event.type === "state-change") {
        setState(event.payload as CallEngineState);
      }
    });

    return unsubscribe;
  }, []);

  return {
    state,
    engine: engineRef.current,
    initiateCall: useCallback(
      (opts: { callId: string; participantIds: string[]; kind: "audio" | "video"; video: boolean }) =>
        engineRef.current.initiateCall(opts),
      [],
    ),
    receiveCall: useCallback(
      (opts: { callId: string; initiatorId: string; kind: "audio" | "video" }) =>
        engineRef.current.receiveCall(opts),
      [],
    ),
    acceptCall: useCallback((video: boolean) => engineRef.current.acceptCall(video), []),
    declineCall: useCallback(() => engineRef.current.declineCall(), []),
    endCall: useCallback(() => engineRef.current.endCall(), []),
    setAudioEnabled: useCallback((enabled: boolean) => engineRef.current.setAudioEnabled(enabled), []),
    setVideoEnabled: useCallback((enabled: boolean) => engineRef.current.setVideoEnabled(enabled), []),
  };
}
