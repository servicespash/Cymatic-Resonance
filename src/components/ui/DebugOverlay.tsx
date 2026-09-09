import React from "react";

export const DebugOverlay = () => {
  if (process.env.NODE_ENV === "production" && !window.location.search.includes("debug=true")) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 p-4 rounded-lg border border-red-500 text-[10px] text-red-300 font-mono max-w-xs max-h-60 overflow-auto">
      <h2 className="font-bold text-white mb-2">Debug Console</h2>
      <pre>
        {/* @ts-ignore */}
        {window.__lastError?.message || "No errors recorded"}
      </pre>
    </div>
  );
};
