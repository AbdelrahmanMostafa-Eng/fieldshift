"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CROPS, hasEconomics } from "@/data/crops";
import { BASE_LAYER, GIBS_CREDIT, OVERLAYS, gibsDate } from "@/lib/gibs";
import { dirFor } from "@/i18n/config";
import { formatMoney, fromUsd, listCurrencies, type Rates } from "@/lib/roi";
import { recommend } from "@/lib/rotation/engine";
import type { ClimateSeries, Weights } from "@/lib/rotation/types";
import type { ForecastDay } from "@/lib/openmeteo";
import { AssistantChat } from "./AssistantChat";
import { CostTracker } from "./CostTracker";
import { CropLibrary } from "./CropLibrary";
import { CursorRing } from "./CursorRing";
import { Globe, type GlobeInset } from "./Globe";
import { LayersPanel, initialOverlayState, type OverlayState } from "./LayersPanel";
import { LanguageSelect } from "./LanguageSelect";
import { LocateButton, PlaceSearch } from "./LocationControls";
import { ResultsSheet } from "./ResultsSheet";
import { SeasonsPanel } from "./SeasonsPanel";
import { SoilExplorer } from "./SoilExplorer";
import { StrategyCard, StrategySkeleton } from "./StrategyCard";
import { ThemeToggle } from "./ThemeToggle";
import { CropCombobox } from "./ui/CropCombobox";
import { Icon } from "./ui/Icon";
import { Range } from "./ui/Range";
import { Segmented } from "./ui/Segmented";
import { useDismiss, useOnline, useThumb } from "./ui/hooks";

type Loc = { lat: number; lon: number };
type Status = "idle" | "loading" | "ready" | "failed";
type ViewMode = "globe" | "flat";
const TABS = ["rotations", "seasons", "costs", "crops", "soil", "atlas"] as const;
type Tab = (typeof TABS)[number];
const WEIGHT_KEYS = ["soil", "water", "climate", "economics", "risk"] as const;
const MONTHS = Array.from({ length: 12 }, (_, i) => i);
const PRICED = CROPS.filter(hasEconomics).length;
const PANEL_WIDTH = 440; // the island on laptops (see ResultsSheet)
const ISLAND_GAP = 12;   // space around the island, and between it and the header controls
const WIDE = 1024;       // the lg breakpoint
// Header tiers, by the width left for it. Below COMPACT the view and theme controls move into one menu.
const COMPACT = 720, ROOMY = 1060;

/** Phones: the 2D/3D switch and the theme share one small menu, so the header stays a single row. */
function ViewMenu({ view, onView, showView }: { view: ViewMode; onView: (v: ViewMode) => void; showView: boolean }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);
  return (
    <div ref={box}>
      <button type="button" className="fs-btn fs-btn-quiet fs-btn-icon" aria-expanded={open} aria-label={t("more")} title={t("more")} onClick={() => setOpen((o) => !o)}><Icon name="sliders" /></button>
      {open && (
        <div role="group" aria-label={t("more")} className="fs-pop absolute end-3 top-full z-40 mt-2 w-[min(19rem,calc(100vw-1.5rem))] space-y-3 p-4 text-start">
          {showView && (
            <div><p className="fs-eyebrow mb-1.5">{t("view")}</p>
              <Segmented block label={t("view")} value={view} onChange={onView} options={[{ value: "globe", label: t("globe"), icon: "globe" }, { value: "flat", label: t("flat"), icon: "map" }]} /></div>
          )}
          <div><p className="fs-eyebrow mb-1.5">{t("theme")}</p><ThemeToggle iconOnly={false} block /></div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const t = useTranslations();
  const locale = useLocale();
  const [intro, setIntro] = useState(true);
  const [introOut, setIntroOut] = useState(false); // the intro is fading away; it is removed when that ends
  const [spin, setSpin] = useState(true);
  const [flat, setFlat] = useState(false);
  const [noGlobe, setNoGlobe] = useState(false); // true when the device cannot draw the 3D map
  const [loc, setLoc] = useState<Loc | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null); // a name from the search; null = show coordinates
  const [attempt, setAttempt] = useState(0); // "Try again" after a failed climate request
  const [climate, setClimate] = useState<ClimateSeries | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [tab, setTab] = useState<Tab>("rotations");
  const [overlays, setOverlays] = useState<OverlayState>(initialOverlayState);
  const [layersOpen, setLayersOpen] = useState(false);
  const [daysBack, setDaysBack] = useState(1);
  const [date, setDate] = useState(() => gibsDate(1));
  const [view, setView] = useState({ w: 1280, h: 800 });
  const [sheetPx, setSheetPx] = useState(0);
  const [headerPx, setHeaderPx] = useState(68);
  const header = useRef<HTMLElement>(null);
  const tabStrip = useRef<HTMLDivElement>(null);
  const introLabel = useRef<HTMLParagraphElement>(null);
  const [introTextPx, setIntroTextPx] = useState(0); // space the intro text takes at the bottom of narrow screens
  const [history, setHistory] = useState(["wheat", "wheat", "maize"]);
  const [current, setCurrent] = useState(["wheat", "maize", "wheat"]);
  const [startMonth, setStartMonth] = useState(9);
  const [irrigated, setIrrigated] = useState(false);
  const [weights, setWeights] = useState<Weights>({ soil: 5, water: 5, climate: 5, economics: 5, risk: 5 });
  const [currency, setCurrency] = useState("USD");
  const [rates, setRates] = useState<Rates>({});
  const rtl = dirFor(locale) === "rtl";
  const online = useOnline();
  const deferredWeights = useDeferredValue(weights);

  // Viewport size, for framing the globe around the intro text, the header and the results panel.
  useEffect(() => {
    const on = () => setView({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    const el = header.current;
    if (intro || !el) return;
    const ro = new ResizeObserver(() => setHeaderPx(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [intro]);

  // On narrow screens the intro text sits under the globe. Measure it, so the globe never runs into the text
  // (short landscape tablets, long translations, large font settings).
  useEffect(() => {
    const el = introLabel.current, block = el?.parentElement;
    if (!intro || !el || !block) return;
    const ro = new ResizeObserver(() => setIntroTextPx(Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    for (const child of [block, ...block.children]) ro.observe(child);
    return () => ro.disconnect();
  }, [intro]);

  // Leaving the intro removes the button that had focus: hand it to the place search so keyboard users carry on from there.
  useEffect(() => {
    // Not on touch screens: focusing a text box there would pop up the on-screen keyboard.
    if (intro || !window.matchMedia("(pointer: fine)").matches) return;
    const id = requestAnimationFrame(() => {
      if (document.activeElement === document.body) header.current?.querySelector<HTMLElement>("[role=combobox]")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [intro]);

  // The date slider moves freely; the map only reloads tiles 250 ms after it settles.
  useEffect(() => {
    const id = setTimeout(() => setDate(gibsDate(daysBack)), 250);
    return () => clearTimeout(id);
  }, [daysBack]);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/fx", { signal: ctl.signal }).then((r) => (r.ok ? r.json() : null)).then((j: { rates?: Rates } | null) => j?.rates && setRates(j.rates)).catch(() => {});
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    if (!loc) return;
    const ctl = new AbortController();
    Promise.resolve().then(() => { setStatus("loading"); setClimate(null); });
    fetch(`/api/climate?lat=${loc.lat}&lon=${loc.lon}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { series: ClimateSeries }) => { setClimate(j.series); setStatus("ready"); })
      .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === "AbortError")) setStatus("failed"); });
    return () => ctl.abort();
  }, [loc, attempt]);

  useEffect(() => {
    if (!loc) return;
    const ctl = new AbortController();
    Promise.resolve().then(() => setForecast(null));
    fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { days?: ForecastDay[] } | null) => setForecast(j?.days ?? null))
      .catch(() => {});
    return () => ctl.abort();
  }, [loc]);

  const strategies = useMemo(
    () => (climate ? recommend({ climate, catalog: CROPS, history, current, startMonth, irrigated, hasLocalSoil: false, weights: deferredWeights }) : []),
    [climate, history, current, startMonth, irrigated, deferredWeights],
  );
  // Same rule as the assistant uses, so the summary, the entries and Atlas always name the same strategy.
  const top = useMemo(() => (strategies.length ? [...strategies].sort((a, b) => b.scores.overall - a.scores.overall)[0] : null), [strategies]);

  const currencies = useMemo(() => listCurrencies(locale).filter((c) => c.code === "USD" || c.code in rates), [locale, rates]);
  const money = (usd: number) => formatMoney(fromUsd(usd, currency, rates) ?? usd, fromUsd(usd, currency, rates) === null ? "USD" : currency, locale);

  const wide = view.w >= WIDE;
  const free = view.w - (wide ? PANEL_WIDTH + ISLAND_GAP * 2 : 0) - 24; // width left for the header controls
  const compact = free < COMPACT, roomy = free >= ROOMY;
  const inset = useMemo<GlobeInset>(() => {
    if (intro) return wide ? { top: 0, bottom: 0, start: Math.max(Math.round(view.w * 0.4), 520), end: 0 } : { top: 64, bottom: Math.max(Math.round(view.h * 0.46), introTextPx + 24), start: 0, end: 0 };
    return wide ? { top: headerPx, bottom: 0, start: PANEL_WIDTH + ISLAND_GAP, end: 0 } : { top: headerPx, bottom: sheetPx, start: 0, end: 0 };
  }, [intro, wide, view.w, view.h, headerPx, sheetPx, introTextPx]);
  const activeOverlays = useMemo(() => OVERLAYS.filter((o) => overlays[o.id]?.on).map((o) => ({ layer: o, opacity: overlays[o.id].opacity })), [overlays]);
  const changeOverlay = useCallback((id: string, patch: Partial<{ on: boolean; opacity: number }>) => setOverlays((s) => ({ ...s, [id]: { ...s[id], ...patch } })), []);
  const stopSpin = useCallback(() => setSpin(false), []);
  const globeUnsupported = useCallback(() => setNoGlobe(true), []);

  const leaveIntro = () => { if (intro) setIntroOut(true); setIntro(false); setSpin(false); };
  const pick = (lat: number, lon: number, label?: string) => { setLoc({ lat, lon }); setPlaceLabel(label ?? null); leaveIntro(); setTab("rotations"); };
  const setAt = (arr: string[], set: (v: string[]) => void, i: number, v: string) => set(arr.map((x, j) => (j === i ? v : x)));
  const cropRow = (arr: string[], set: (v: string[]) => void, label: string) => (
    <div>
      <span className="text-muted">{label}</span>
      {/* `relative`: the crop list hangs from this row, across all three pickers */}
      <div className="relative mt-1 flex gap-2">
        {[0, 1, 2].map((i) => <CropCombobox key={i} label={`${label} ${i + 1}`} value={arr[i]} onChange={(v) => setAt(arr, set, i, v)} />)}
      </div>
    </div>
  );

  const n2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const coords = loc ? [`${n2.format(Math.abs(loc.lat))}° ${t(loc.lat >= 0 ? "place.n" : "place.s")}`, `${n2.format(Math.abs(loc.lon))}° ${t(loc.lon >= 0 ? "place.e" : "place.w")}`].join(rtl ? "، " : ", ") : "";
  const placeName = placeLabel ?? coords;
  const statusLine = !loc ? t("plan.pickHint")
    : status === "loading" ? t("plan.loading")
    : status === "failed" ? t("plan.failed")
    : top ? `${t("results.count", { count: strategies.length })} · ${t("results.topFor", { name: t(`results.strategy.${top.id}`), score: Math.round(top.scores.overall) })}`
    : "";
  useThumb(tabStrip, `${tab}|${locale}`);
  const viewOptions = [{ value: "globe" as const, label: t("nav.globe"), icon: "globe" as const }, { value: "flat" as const, label: t("nav.flat"), icon: "map" as const }];
  const setViewMode = (v: ViewMode) => setFlat(v === "flat");
  // Tabs pattern: arrow keys move along the row (mirrored right to left), Home and End jump to the ends.
  const tabKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.indexOf(tab), last = TABS.length - 1;
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? last : step ? (i + step + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next]);
    document.getElementById(`fs-tab-${TABS[next]}`)?.focus();
  };

  const summary = (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-content-center rounded-[14px] bg-paper text-gold-text shadow-[inset_0_0_0_1px_var(--line),inset_0_1px_0_var(--rim-hi)]"><Icon name={loc ? "pin" : "globe"} /></span>
      <div className="min-w-0 flex-1">
        <p className="fs-eyebrow truncate">{loc ? t("results.place") : "FieldShift"}</p>
        <h2 className="truncate font-serif text-xl leading-snug" dir="auto">{loc ? placeName : t("plan.pickTitle")}</h2>
        <p className="truncate text-sm text-muted" aria-live="polite">{statusLine}</p>
      </div>
    </div>
  );

  // Nothing picked yet, climate still loading, or the request failed: said in words, with a way forward.
  const stateBlock = (
                <div aria-live="polite">
                  {status === "idle" && (
                    <div className="mt-6 rounded-lg border border-dashed border-line-strong px-5 py-6 text-center">
                      <Icon name="pin" size={28} className="mx-auto text-gold-text" />
                      <p className="mt-2 font-serif text-lg">{t("plan.pickTitle")}</p>
                      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{t("plan.pickPlace")} {t("plan.pickHint")}</p>
                    </div>
                  )}
                  {status === "loading" && (
                    <div className="mt-6 border-t border-line pt-5" role="status" aria-label={t("plan.loading")}>
                      <p className="flex items-center gap-2 text-sm text-muted"><Icon name="spinner" size={16} />{t("plan.loading")}</p>
                      <div className="mt-2 divide-y divide-line"><StrategySkeleton /><StrategySkeleton /></div>
                    </div>
                  )}
                  {status === "failed" && (
                    <div role="alert" className="mt-6 flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
                      <Icon name="alert" className="mt-0.5 text-danger" />
                      <div>
                        <p>{t("plan.failed")}</p>
                        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="fs-btn fs-btn-quiet mt-3">{t("plan.retry")}</button>
                      </div>
                    </div>
                  )}
                </div>
  );

  return (
    <main className="fs-space relative h-dvh w-full overflow-hidden">
      {(intro || introOut) && (
        // The veil and the text let touches through, so the globe behind stays draggable; only the controls catch them.
        <div className={`fs-intro-veil pointer-events-none absolute inset-0 z-30 flex flex-col text-[#f1ece0] ${introOut ? "fs-intro-out" : ""}`}
          onAnimationEnd={(e) => { if (introOut && e.target === e.currentTarget) setIntroOut(false); }}>
          <div className="flex items-center justify-between gap-2 p-3 lg:px-8 lg:pt-6">
            <p className="flex items-center gap-2 font-mono text-xs tracking-[0.28em] text-[#e9c26a]"><Icon name="sprout" />FIELDSHIFT</p>
            <div className="pointer-events-auto flex items-center gap-2">
              <LanguageSelect tone="dark" compact />
              <button type="button" onClick={leaveIntro} className="fs-btn fs-btn-ghost px-3">{t("intro.skip")}<Icon name="arrow" size={16} /></button>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-end px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-center lg:items-start lg:justify-center lg:px-16 lg:pb-20 lg:text-start">
            <p ref={introLabel} className="fs-intro-item fs-eyebrow text-[#e9c26a]" style={{ ["--i" as string]: 0 }}>{t("intro.label")}</p>
            <h1 className="fs-intro-item fs-intro-title mt-4 max-w-2xl font-serif text-[2rem] leading-[1.14] sm:text-5xl sm:leading-[1.1] lg:max-w-[31rem] lg:text-[3.25rem]" style={{ ["--i" as string]: 1 }}>
              {t.rich("intro.title", { em: (chunks) => <em>{chunks}</em> })}
            </h1>
            <p className="fs-intro-item mt-4 max-w-xl text-base text-[#f1ece0]/75 lg:max-w-[26rem]" style={{ ["--i" as string]: 2 }}>{t("intro.subtitle")}</p>
            <div className="fs-intro-item pointer-events-auto mt-7 flex flex-wrap justify-center gap-3 lg:justify-start" style={{ ["--i" as string]: 3 }}>
              <LocateButton onLocated={pick} />
              <button type="button" onClick={leaveIntro} className="fs-btn fs-btn-ghost">{t("intro.explore")}</button>
            </div>
            <p className="fs-intro-item mt-6 font-mono text-[11px] tracking-[0.14em] text-[#f1ece0]/55" style={{ ["--i" as string]: 4 }}>{t("intro.finePrint")}</p>
          </div>
        </div>
      )}

      {!intro && (
        <>
          {/* The bar itself lets clicks through to the globe; only its controls catch them. */}
          <header ref={header} className={`fs-chrome pointer-events-none absolute inset-x-0 top-0 flex items-center justify-end gap-2 p-3 *:pointer-events-auto lg:ps-[464px] ${layersOpen ? "z-40" : "z-30"}`}>
            {compact ? <PlaceSearch grow onPick={pick} onLocated={pick} /> : <><PlaceSearch onPick={pick} /><LocateButton onLocated={pick} variant={roomy ? "primary" : "icon"} /></>}
            {/* The 2D switch and the satellite layers belong to the 3D map; the flat fallback has neither. */}
            {!noGlobe && !compact && <Segmented label={t("nav.view")} value={flat ? "flat" : "globe"} onChange={setViewMode} iconOnly={!roomy} options={viewOptions} />}
            {!noGlobe && <LayersPanel state={overlays} onChange={changeOverlay} daysBack={daysBack} onDaysBack={setDaysBack} rtl={rtl} onOpenChange={setLayersOpen} compact={compact} anchor={compact ? "bar" : "self"} />}
            <LanguageSelect compact={!roomy} anchor={compact ? "bar" : "self"} />
            {compact ? <ViewMenu view={flat ? "flat" : "globe"} onView={setViewMode} showView={!noGlobe} /> : <ThemeToggle />}
          </header>

          <ResultsSheet title={t("results.title")} summary={summary} onVisibleChange={setSheetPx}>
            <div ref={tabStrip} role="tablist" aria-label={t("results.title")} className="fs-seg fs-tabs" onKeyDown={tabKeys}>
              {TABS.map((k) => (
                <button key={k} id={`fs-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="fs-tabpanel" tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}>{t(`tabs.${k}`)}</button>
              ))}
            </div>
            <div id="fs-tabpanel" role="tabpanel" aria-labelledby={`fs-tab-${tab}`}>
            <div key={tab} className="fs-swap">

            {tab === "atlas" && <div className="mt-4 h-[55dvh]"><AssistantChat location={loc} climate={climate} forecast={forecast} strategies={strategies} startMonth={startMonth} money={money} /></div>}
            {tab === "seasons" && (climate ? <SeasonsPanel climate={climate} forecast={forecast} plan={current} /> : stateBlock)}
            {tab === "costs" && <CostTracker plan={current} currency={currency} rates={rates} money={money} />}
            {tab === "crops" && <CropLibrary plan={current} onUse={(i, id) => setAt(current, setCurrent, i, id)} money={money} climate={climate} irrigated={irrigated} />}
            {tab === "soil" && <SoilExplorer />}
            {tab === "rotations" && (
              <>
                <section className="mt-5">
                  <p className="fs-eyebrow">{t("plan.field")}</p>
                  <div className="mt-2 min-w-0 space-y-3 text-sm">
                    {cropRow(history, setHistory, t("plan.history"))}
                    {cropRow(current, setCurrent, t("plan.current"))}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      <label className="flex items-center gap-2"><span className="text-muted">{t("plan.startMonth")}</span>
                        <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="fs-field">
                          {MONTHS.map((m) => <option key={m} value={m}>{new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, m, 1))}</option>)}
                        </select></label>
                      <label className="fs-tap"><input type="checkbox" role="switch" className="fs-switch" checked={irrigated} onChange={(e) => setIrrigated(e.target.checked)} />{t("plan.irrigated")}</label>
                    </div>
                    <div>
                      <span className="text-muted">{t("plan.priorities")}</span>
                      {WEIGHT_KEYS.map((k) => (
                        <label key={k} className="flex items-center gap-3">
                          <span className="w-28 shrink-0">{t(`plan.${k}`)}</span>
                          <Range min={0} max={10} value={weights[k]} bubble={t("plan.importance", { value: weights[k] })} onChange={(v) => setWeights({ ...weights, [k]: v })} />
                          <span className="w-5 shrink-0 text-end font-mono text-xs text-muted" aria-hidden="true">{weights[k]}</span>
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-2"><span className="text-muted">{t("money.currency")}</span>
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="fs-field min-w-0 flex-1">
                        {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                      </select></label>
                  </div>
                </section>

                {stateBlock}

                {strategies.length > 0 && (
                  <section className="mt-6 border-t border-line pt-5">
                    <p className="fs-eyebrow">{t("results.title")}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{t("results.note")} {t("results.pool", { count: PRICED })}</p>
                    <div className="divide-y divide-line">
                      {strategies.map((s, i) => <StrategyCard key={s.id} s={s} index={i} top={s.id === top?.id} money={money} />)}
                    </div>
                  </section>
                )}
                {Object.keys(rates).length > 0 && <p className="mt-2 text-xs text-muted">{t("money.ratesFrom")}</p>}
              </>
            )}
            </div>
            </div>
            <footer className="mt-6 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
              <p>{t("footer.credit")} {GIBS_CREDIT}. {BASE_LAYER.label}.</p>
              <p className="mt-1">{t("footer.crops")}</p>
              <p className="mt-1">{t("footer.terrain")} {t("footer.places")}</p>
              <p className="mt-1">{t("footer.weather")}</p>
              <p className="mt-1">{t("footer.disclaimer")}</p>
            </footer>
          </ResultsSheet>
        </>
      )}
      {/* Last in the DOM so the tab order reaches the intro, search and results before the map's own buttons. Overlays stack above it by z-index. */}
      <Globe projection={flat ? "mercator" : "globe"} spin={spin} marker={loc} date={date} overlays={activeOverlays}
        locale={locale} rtl={rtl} inset={inset} controlsBottom={!intro && !wide ? sheetPx : 0} homeVisible={!intro} onPick={pick} onUserInteract={stopSpin} onUnsupported={globeUnsupported} />

      {!online && (
        <p role="status" className="fs-pop pointer-events-none absolute inset-x-3 z-50 mx-auto flex max-w-md items-start gap-2 px-4 py-3 text-sm" style={{ top: intro ? 64 : headerPx + 8 }}>
          <Icon name="alert" size={18} className="mt-0.5 text-gold-text" />{t("nav.offline")}
        </p>
      )}
      <CursorRing />
    </main>
  );
}
