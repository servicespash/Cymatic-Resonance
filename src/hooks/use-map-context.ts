import { useContext } from "react";
import { MapContext } from "@/context/map-context-base";

export function useMapContext() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMapContext must be used within a MapProvider");
  }
  return context;
}
