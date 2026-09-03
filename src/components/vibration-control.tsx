import React from "react";

export function VibrationControl() {
  const triggerHaptic = (pattern: number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  return (
    <div className="glass p-4 rounded-xl space-y-2">
      <h3 className="text-sm font-semibold">Haptic Feedback</h3>
      <div className="flex gap-2">
        <button
          onClick={() => triggerHaptic([50])}
          className="px-3 py-1 bg-white/10 rounded text-xs"
        >
          Tap
        </button>
        <button
          onClick={() => triggerHaptic([100, 50, 100])}
          className="px-3 py-1 bg-white/10 rounded text-xs"
        >
          Pulse
        </button>
      </div>
    </div>
  );
}
