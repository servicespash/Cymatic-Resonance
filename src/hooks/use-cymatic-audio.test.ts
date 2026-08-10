import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCymaticAudio } from "./use-cymatic-audio";

describe("useCymaticAudio", () => {
  it("should return playTone function", () => {
    const { result } = renderHook(() => useCymaticAudio());
    expect(typeof result.current.playTone).toBe("function");
  });

  it("should create AudioContext when playTone is called", async () => {
    // Define class
    class MockAudioContext {
      createOscillator = vi.fn().mockReturnValue({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      });
      createGain = vi.fn().mockReturnValue({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      });
      currentTime = 0;
      destination = {};
    }

    // @ts-expect-error Mocking global AudioContext for testing
    global.AudioContext = MockAudioContext;
    const audioContextSpy = vi.spyOn(global, "AudioContext");

    const { result } = renderHook(() => useCymaticAudio());
    await result.current.playTone(440, 1);

    expect(audioContextSpy).toHaveBeenCalled();
  });
});
