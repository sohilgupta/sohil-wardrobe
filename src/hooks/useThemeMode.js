import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "wdb_theme";
const VALID = ["light", "dark"];

function readInitial() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored) ? stored : "light";
}

export default function useThemeMode() {
  const [mode, setMode] = useState(readInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  return { mode, toggle };
}
