import { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { Theme, ThemeContext } from "./theme-context-core";

const STORAGE_KEY = "cymatic-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme;
        if (stored === "dark" || stored === "light") return stored;
      } catch (e) {
        // Ignore localStorage errors (e.g., incognito mode)
      }
    }
    return "dark"; // Default theme
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Handle mobile incognito / privacy modes where localStorage might fail
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
