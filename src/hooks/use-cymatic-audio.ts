import { useCallback, useRef } from "react";

export const useCymaticAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playTone = useCallback(
    async (
      frequency: number,
      duration: number,
      type: OscillatorType = "sine",
      rampUp: boolean = false,
    ) => {
      if (!audioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextConstructor();
      }

      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      if (rampUp) {
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4);
      } else {
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      }
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [],
  );

  return { playTone };
};
