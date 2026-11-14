"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "./ui/Segmented";

type Mode = "light" | "dark" | "system";

function writeTheme(m: Mode) {
  try {
    if (m === "system") { localStorage.removeItem("theme"); delete document.documentElement.dataset.theme; }
    else { localStorage.setItem("theme", m); document.documentElement.dataset.theme = m; }
  } catch {}
}

export function ThemeToggle({ iconOnly = true, block = false }: { iconOnly?: boolean; block?: boolean }) {
  const t = useTranslations("nav");
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const s = localStorage.getItem("theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s === "light" || s === "dark") setMode(s);
    } catch {}
  }, []);
  return (
    <Segmented label={t("theme")} value={mode} iconOnly={iconOnly} block={block} onChange={(m) => { setMode(m); writeTheme(m); }}
      options={[{ value: "light", label: t("light"), icon: "sun" }, { value: "system", label: t("system"), icon: "monitor" }, { value: "dark", label: t("dark"), icon: "moon" }]} />
  );
}
