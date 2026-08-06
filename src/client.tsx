import { hydrateRoot } from "react-dom/client";
import { getRouter } from "./router";
import { RouterProvider } from "@tanstack/react-router";

async function main() {
  try {
    const router = await getRouter();
    hydrateRoot(document.getElementById("root")!, <RouterProvider router={router} />);
  } catch (error: any) {
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `<div style="padding: 20px; color: red;">
        <h1>App failed to start</h1>
        <pre>${error?.message || String(error)}</pre>
      </div>`;
    }
  }
}

main();
