import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

export function initDebugOverlay() {
  const container = document.createElement("div");
  container.id = "debug-overlay";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.right = "0";
  container.style.zIndex = "999999";
  container.style.background = "rgba(0,0,0,0.8)";
  container.style.color = "white";
  container.style.padding = "10px";
  container.style.fontSize = "12px";
  container.style.maxWidth = "300px";
  container.style.maxHeight = "400px";
  container.style.overflow = "auto";
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);

  function DebugOverlay() {
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
      const handleError = (event: ErrorEvent | PromiseRejectionEvent) => {
        let msg = "";
        if ("reason" in event) {
          msg = `Rejection: ${event.reason}`;
        } else {
          msg = `Error: ${event.message} at ${event.filename}:${event.lineno}`;
        }
        setErrors((prev) => [...prev, msg]);
      };

      window.addEventListener("error", handleError);
      window.addEventListener("unhandledrejection", handleError);
      return () => {
        window.removeEventListener("error", handleError);
        window.removeEventListener("unhandledrejection", handleError);
      };
    }, []);

    return (
      <div>
        <button onClick={() => setErrors([])} style={{ marginBottom: "5px", fontSize: "10px" }}>
          Clear
        </button>
        {errors.map((e, i) => (
          <div key={i} style={{ marginBottom: "5px", borderBottom: "1px solid #444" }}>
            {e}
          </div>
        ))}
      </div>
    );
  }

  root.render(<DebugOverlay />);
}
