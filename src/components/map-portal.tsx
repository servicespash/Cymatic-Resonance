import { createPortal } from "react-dom";
import { ReactNode, useEffect } from "react";
import { useMapContext } from "@/context/map-context";

export function MapPortal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { isFullscreen } = useMapContext();

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEsc);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isFullscreen, onClose]);

  if (!isFullscreen) return <>{children}</>;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background w-screen h-screen">{children}</div>,
    document.body,
  );
}
