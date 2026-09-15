import { useState, ReactNode } from "react";
import { MapContext } from "./map-context-base";

export function MapProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
      return next;
    });
  };

  return (
    <MapContext.Provider value={{ isFullscreen, toggleFullscreen }}>{children}</MapContext.Provider>
  );
}
