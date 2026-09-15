import { createContext } from "react";

export interface MapContextType {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

export const MapContext = createContext<MapContextType | undefined>(undefined);
