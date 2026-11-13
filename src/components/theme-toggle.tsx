"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const noop = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the theme, and React keeps the server's attributes on
  // hydration: the label waits for the browser (false on the server and while hydrating).
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 sm:size-9"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={
        !mounted
          ? "Alternar tema claro ou escuro"
          : dark
            ? "Ativar tema claro"
            : "Ativar tema escuro"
      }
    >
      {/* Both icons render; CSS picks one, so server and client markup match. */}
      <Sun className="hidden dark:block" aria-hidden />
      <Moon className="block dark:hidden" aria-hidden />
    </Button>
  );
}
