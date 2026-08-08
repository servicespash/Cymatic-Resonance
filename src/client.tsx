import { createRoot } from "react-dom/client";
import { getRouter } from "./router";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";

async function main() {
  try {
    let root = document.getElementById("root");
    if (!root) {
      root = document.createElement("div");
      root.id = "root";
      document.body.appendChild(root);
    }

    root.innerHTML = "";
    const router = await getRouter();

    const rootElement = createRoot(root);
    rootElement.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack || "" : "";
    document.body.innerHTML = `<div style="padding: 20px; color: red; background: black; min-height: 100vh; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999;">
      <h1>RENDER ERROR</h1>
      <pre style="white-space: pre-wrap;">${errorMsg}</pre>
      <pre style="white-space: pre-wrap; font-size: 10px;">${stack}</pre>
    </div>`;
  }
}

main();
