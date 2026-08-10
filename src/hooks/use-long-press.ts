import { useCallback, useRef } from "react";

export const useLongPress = (
  callback: (e: React.MouseEvent | React.TouchEvent) => void,
  ms = 500,
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      timerRef.current = setTimeout(() => callback(e), ms);
    },
    [callback, ms],
  );

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: stop,
  };
};
