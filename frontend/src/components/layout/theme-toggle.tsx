"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem("hotel-erp-theme", theme);
}

export function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle color theme"
      title="Toggle color theme"
      onClick={() => {
        const nextTheme: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
        applyTheme(nextTheme);
      }}
    >
      <Moon className="dark:hidden" aria-hidden="true" />
      <Sun className="hidden dark:block" aria-hidden="true" />
    </Button>
  );
}
