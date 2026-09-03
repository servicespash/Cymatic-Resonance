import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative flex items-center p-0.5 rounded-full bg-black/10 border border-white/10 hover:bg-black/20 dark:bg-white/5 dark:hover:bg-white/10 transition-colors shadow-inner w-14 h-7"
      aria-label={`Toggle theme (currently ${theme})`}
    >
      <div
        className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-background shadow-sm border border-border/50 transition-all duration-300 ease-in-out ${
          theme === "dark" ? "left-[calc(50%+1px)]" : "left-0.5"
        }`}
      />

      <div className="relative z-10 flex-1 flex justify-center text-foreground">
        <Sun
          className={`size-3.5 transition-colors duration-200 ${theme === "light" ? "text-accent-foreground" : "text-muted-foreground/60"}`}
        />
      </div>
      <div className="relative z-10 flex-1 flex justify-center text-foreground">
        <Moon
          className={`size-3.5 transition-colors duration-200 ${theme === "dark" ? "text-accent-foreground" : "text-muted-foreground/60"}`}
        />
      </div>
    </button>
  );
}
