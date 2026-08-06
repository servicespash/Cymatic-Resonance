import { createRoot } from "react-dom/client";
import { getRouter } from "./router";
import { RouterProvider } from "@tanstack/react-router";

async function main() {
  const root = document.getElementById("root");
  if (!root) return;

  try {
    const router = await getRouter();
    // Force a full re-render, clearing the server-rendered shell
    root.innerHTML = ""; 
    createRoot(root).render(<RouterProvider router={router} />);
  } catch (error: any) {
    root.innerHTML = `<div style="padding: 20px; color: red;">
        <h1>App failed to start</h1>
        <pre>${error?.message || String(error)}</pre>
      </div>`;
  }
}

main();
