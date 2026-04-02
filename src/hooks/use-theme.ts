import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sano-theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("sano-theme", theme);
  }, [theme]);

  const toggleTheme = () => setThemeState((t) => (t === "light" ? "dark" : "light"));

  return { theme, toggleTheme };
}
