import { hydrateRoot } from 'react-dom/client';
import { getRouter } from './router';
import { RouterProvider } from '@tanstack/react-router';

async function main() {
  const router = await getRouter();
  hydrateRoot(document.getElementById('root')!, <RouterProvider router={router} />);
}

main();
