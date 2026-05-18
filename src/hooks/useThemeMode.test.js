import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useThemeMode from "./useThemeMode";

describe("useThemeMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to light when localStorage is empty", () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.mode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("restores persisted dark mode from localStorage", () => {
    localStorage.setItem("wdb_theme", "dark");
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.mode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggle() flips light → dark and persists", () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("dark");
    expect(localStorage.getItem("wdb_theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggle() flips dark → light and persists", () => {
    localStorage.setItem("wdb_theme", "dark");
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("light");
    expect(localStorage.getItem("wdb_theme")).toBe("light");
  });

  it("ignores invalid localStorage values and defaults to light", () => {
    localStorage.setItem("wdb_theme", "neon");
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.mode).toBe("light");
  });
});
