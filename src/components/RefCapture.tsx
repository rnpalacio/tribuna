"use client";
import { useEffect } from "react";

/** Guarda el código de referido (?ref=XXXX) en localStorage para canjearlo al onboardear. */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem("tribuna_ref", ref.trim().toUpperCase());
    } catch {}
  }, []);
  return null;
}
