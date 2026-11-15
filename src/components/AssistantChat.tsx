"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { answer, type AssistantContext, type Reply } from "@/lib/assistant";
import { Icon } from "./ui/Icon";

type Ctx = Omit<AssistantContext, "lang">;
interface Msg { role: "user" | "assistant"; text: string; sources?: string[] }
/** The conversation so far. Kept by the page, so it survives switching tabs (this panel unmounts). */
export interface AtlasLog { msgs: Msg[]; suggestions: string[] | null }
export const EMPTY_LOG: AtlasLog = { msgs: [], suggestions: null };

/** Free rule-based helper: runs entirely in the browser, no model, no network, no key. */
export function AssistantChat({ log, onLog, ...props }: Ctx & { log: AtlasLog; onLog: (update: (l: AtlasLog) => AtlasLog) => void }) {
  const t = useTranslations("atlas");
  const lang = useLocale();
  const { msgs, suggestions } = log;
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (i: number, text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1600); }).catch(() => {}); };
  const box = useRef<HTMLDivElement>(null);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    const r: Reply = answer(text, { ...props, lang });
    onLog((l) => ({ msgs: [...l.msgs, { role: "user", text }, { role: "assistant", text: r.text, sources: r.sources }], suggestions: r.suggestions }));
    setInput("");
  };

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  const first = answer("hello", { ...props, lang });
  const chips = suggestions ?? first.suggestions;

  return (
    <div className="flex h-full flex-col">
      <div ref={box} className="flex-1 space-y-4 overflow-y-auto py-2" aria-live="polite" role="log" aria-label={t("title")}>
        <p className="max-w-[92%] text-sm leading-relaxed" dir="auto">{first.text}</p>
        {msgs.map((m, i) => (
          <div key={i} className={`fs-rise ${m.role === "user" ? "ms-auto max-w-[85%]" : "max-w-[92%]"}`}>
            <p dir="auto" className={m.role === "user" ? "rounded-lg rounded-ee-sm bg-gold px-3 py-2 text-sm text-gold-ink" : "whitespace-pre-wrap text-sm leading-relaxed"}>{m.text}</p>
            {m.sources && m.sources.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1.5">{m.sources.map((s) => <span key={s} className="fs-chip text-muted">{s}</span>)}</p>
            )}
            {m.role === "assistant" && <button type="button" onClick={() => copy(i, m.text)} className="mt-1 min-h-8 text-xs text-muted underline-offset-2 hover:text-ink hover:underline">{copied === i ? t("copied") : t("copy")}</button>}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {chips.map((c) => <button key={c} type="button" onClick={() => ask(c)} className="fs-chip">{c}</button>)}
        </div>
      </div>
      <p className="pt-2 text-[11px] leading-snug text-muted">{t("note")}{lang !== "en" && lang !== "ar" && <> {t("langNote")}</>}</p>
      <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("placeholder")} aria-label={t("title")} maxLength={300} className="fs-field min-w-0 flex-1 text-sm" />
        <button disabled={!input.trim()} aria-label={t("send")} title={t("send")} className="fs-btn fs-btn-primary fs-btn-icon"><Icon name="send" /></button>
      </form>
    </div>
  );
}
