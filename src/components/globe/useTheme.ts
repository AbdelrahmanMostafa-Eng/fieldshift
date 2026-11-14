"use client";
import { useSyncExternalStore } from "react";
import type { Theme } from "./style";

/** The theme actually in effect: the saved choice on <html data-theme>, else the system setting. */
function read(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => { mq.removeEventListener("change", onChange); mo.disconnect(); };
}

export const useTheme = (): Theme => useSyncExternalStore(subscribe, read, () => "dark");
