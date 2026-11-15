"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "./ui/Icon";
import { useDismiss, stepActive } from "./ui/hooks";

interface Hit { label: string; lat: number; lon: number }
type LocateState = "idle" | "busy" | "denied" | "error";

/** Asks the browser for the device position. Reports "denied" and "error" so the caller can show them in words. */
function useLocate(onLocated: (lat: number, lon: number) => void) {
  const [state, setState] = useState<LocateState>("idle");
  const reset = useCallback(() => setState("idle"), []);
  const locate = () => {
    if (!("geolocation" in navigator)) return setState("error");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setState("idle"); onLocated(p.coords.latitude, p.coords.longitude); },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };
  return { state, locate, reset };
}

/**
 * "Find my location". `variant`: "primary" (gold, with text), "icon" (gold square) or "inline" (plain icon inside the search box).
 * A refusal or failure is said in a small note under the button, never as a silent no-op.
 */
export function LocateButton({ onLocated, variant = "primary" }: { onLocated: (lat: number, lon: number) => void; variant?: "primary" | "icon" | "inline" }) {
  const t = useTranslations("nav");
  const { state, locate, reset } = useLocate(onLocated);
  const busy = state === "busy";
  const problem = state === "denied" ? t("locateDenied") : state === "error" ? t("locateError") : "";
  // The note says why nothing happened; a press anywhere else or Escape puts it away again.
  const wrap = useRef<HTMLSpanElement>(null);
  useDismiss(wrap, !!problem, reset);
  const cls = variant === "primary" ? "fs-btn fs-btn-primary" : variant === "icon" ? "fs-btn fs-btn-primary fs-btn-icon"
    : "grid h-9 w-9 place-content-center rounded-sm text-muted transition-colors hover:text-ink";
  return (
    <span ref={wrap} className="relative inline-flex">
      <button type="button" onClick={locate} disabled={busy} aria-busy={busy} aria-label={variant === "primary" ? undefined : t("locate")} title={variant === "primary" ? undefined : t("locate")} className={cls}>
        <Icon name={busy ? "spinner" : "locate"} />
        {variant === "primary" && <span>{t("locate")}</span>}
      </button>
      {problem && (
        <span role="status" className="fs-pop absolute end-0 top-full z-40 mt-2 flex w-60 items-start gap-2 p-3 text-start text-xs leading-snug">
          <Icon name="alert" size={16} className="mt-0.5 text-danger" />{problem}
        </span>
      )}
    </span>
  );
}

/**
 * Place search (Open-Meteo geocoding through /api/geocode). Designed states: searching, no match, failed.
 * `locate` adds the "find my location" icon inside the box, which saves a button on phones.
 */
export function PlaceSearch({ onPick, onLocated, grow = false }: { onPick: (lat: number, lon: number, label: string) => void; onLocated?: (lat: number, lon: number) => void; grow?: boolean }) {
  const t = useTranslations("nav");
  const lang = useLocale();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "empty" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = useRef(""); // the label just picked: typing it into the box must not start a new search
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3 || q === chosen.current) { Promise.resolve().then(() => { setHits([]); setStatus("idle"); }); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("searching");
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(text)}&lang=${lang}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { results?: Hit[] };
        const found = j.results ?? [];
        setHits(found); setActive(0); setStatus(found.length ? "idle" : "empty"); setOpen(true);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) { setHits([]); setStatus("failed"); setOpen(true); }
      }
    }, 350);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, lang]);

  const choose = (h: Hit) => { chosen.current = h.label; setQ(h.label); setHits([]); setOpen(false); onPick(h.lat, h.lon, h.label); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => stepActive(a, 1, hits.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => stepActive(a, -1, hits.length)); }
    else if (e.key === "Enter" && open && hits[active]) { e.preventDefault(); choose(hits[active]); }
  };
  const showList = open && (hits.length > 0 || status === "empty" || status === "failed");

  return (
    <div ref={box} className={`relative ${grow ? "min-w-0 flex-1" : "w-60"}`}>
      <Icon name={status === "searching" ? "spinner" : "search"} size={18} className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={key}
        role="combobox" aria-expanded={showList} aria-controls={id} aria-autocomplete="list" aria-activedescendant={showList && hits[active] ? `${id}-${active}` : undefined}
        placeholder={t("search")} aria-label={t("search")} enterKeyHint="search" autoComplete="off"
        className={`fs-field w-full ps-10 text-sm ${onLocated ? "pe-11" : ""}`} />
      {onLocated && <span className="absolute end-1 top-1/2 z-[1] -translate-y-1/2"><LocateButton onLocated={onLocated} variant="inline" /></span>}
      {showList && (
        <ul id={id} role="listbox" aria-label={t("search")} className="fs-pop absolute start-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-1.5rem))] p-1">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lon}`} id={`${id}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" tabIndex={-1} data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(h)} className="fs-option">
                <Icon name="pin" size={16} className="text-muted" /><span className="min-w-0 flex-1">{h.label}</span>
              </button>
            </li>
          ))}
          {status === "empty" && <li className="px-3 py-3 text-sm text-muted">{t("noResults")}</li>}
          {status === "failed" && <li role="alert" className="flex items-start gap-2 px-3 py-3 text-sm"><Icon name="alert" size={16} className="mt-0.5 text-danger" />{t("searchFailed")}</li>}
        </ul>
      )}
    </div>
  );
}
