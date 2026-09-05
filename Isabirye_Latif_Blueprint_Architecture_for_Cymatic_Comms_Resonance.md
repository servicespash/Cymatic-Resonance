# Isabirye Latif Blueprint Architecture for Cymatic Comms Resonance

## Project Overview

Cymatic Comms Resonance is a high-performance, real-time communication and management dashboard designed as a client-side Single-Page Application (SPA). It leverages React 19, TanStack Router, and Supabase to provide seamless collaboration, interactive mapping, and advanced audio-visual communication tools.

## Folder Structure

- `/src/`: Root source directory.
  - `/components/`: Reusable UI components (shadcn/ui, custom).
  - `/integrations/`: Third-party service integrations (Supabase).
  - `/lib/`: Shared utilities, context definitions, and core logic.
  - `/routes/`: Application routing (TanStack Router).
  - `/styles.css`: Global Tailwind CSS configuration.
  - `/types/`: Global TypeScript interfaces and schema definitions.

## Styling Approach (Tailwind CSS v4)

This project utilizes Tailwind CSS v4's utility-first approach.

- **Custom Variants & Utilities**: Complex aesthetic effects are encapsulated in `src/styles.css` using custom `@utility` directives.
- **Glassmorphism**: Advanced effects, such as `.glass` and `.glass-strong`, are implemented using `color-mix`, `backdrop-filter`, and CSS variables to ensure seamless, theme-aware transitions between light and dark modes.

## Core Architecture & SPA Routing

- **Routing**: Implemented using **TanStack Router**, providing type-safe navigation and robust loader handling for complex, authenticated routes.
- **Client-Side SPA**: The application is strictly client-side. The build process, utilizing Vite, transforms the source code into static assets (served from `dist/client`), ensuring compatibility with static hosting environments.
- **Supabase Integration**: Data access and authentication are centralized through the `src/integrations/supabase/client.ts` wrapper, which standardizes environment variable access (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) across the entire application.

## Key Dependencies for Visuals & Interaction

- **Maps**: `react-leaflet`, `leaflet`, `leaflet-control-geocoder` for admin mapping visualization.
- **Animations/Visuals**: `framer-motion` for complex UI animations, `recharts` for data visualization, and `lucide-react` for iconography.
- **State/Data**: `TanStack Query` for caching and server-state synchronization.
- **Interactions**: `vaul`, `embla-carousel-react`, `cmdk`, and custom haptic feedback utilities (`src/lib/vibration.ts`) for enhanced user experience.
