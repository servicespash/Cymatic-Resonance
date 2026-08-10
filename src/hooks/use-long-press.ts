import { useState, useCallback, useRef } from "react";

export const useLongPress = (
  callback: (e: React.MouseEvent | React.TouchEvent) => void,
  ms = 500,
) => {
  const [startLongPress, setStartLongPress] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      setStartLongPress(true);
      timerRef.current = setTimeout(() => callback(e), ms);
    },
    [callback, ms],
  );

  const stop = useCallback(() => {
    setStartLongPress(false);
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
