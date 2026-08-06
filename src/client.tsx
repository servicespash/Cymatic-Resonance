import { createRoot } from "react-dom/client";
import { getRouter } from "./router";
import { RouterProvider } from "@tanstack/react-router";

async function main() {
  try {
    const root = document.getElementById("root");
    if (!root) throw new Error("Root element not found");
    
    const router = await getRouter();
    root.innerHTML = ""; 
    createRoot(root).render(<RouterProvider router={router} />);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const stack = err?.stack || "";
    document.body.innerHTML = `<div style="padding: 20px; color: red; background: black; min-height: 100vh; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999;">
      <h1>BOOT ERROR</h1>
      <pre style="white-space: pre-wrap;">${errorMsg}</pre>
      <pre style="white-space: pre-wrap; font-size: 10px;">${stack}</pre>
    </div>`;
  }
}

main();
