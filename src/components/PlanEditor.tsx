"use client";
import { useTranslations } from "next-intl";
import { CropCombobox } from "./ui/CropCombobox";
import { Icon } from "./ui/Icon";

/**
 * A row of crop pickers that can grow and shrink: past crops (oldest first) or the planned seasons.
 * Each picker has a remove button while the row is above its minimum; an "add" tile appears below its maximum.
 */
export function PlanEditor({ label, crops, onChange, min, max, addId }: {
  label: string; crops: string[]; onChange: (next: string[]) => void; min: number; max: number;
  /** Crop a new season starts with. */
  addId: string;
}) {
  const t = useTranslations("plan");
  const set = (i: number, id: string) => onChange(crops.map((c, j) => (j === i ? id : c)));
  const remove = (i: number) => onChange(crops.filter((_, j) => j !== i));
  return (
    // Columns follow the panel's own width, not the window's: the sidebar is narrow even on a wide screen.
    <div className="@container">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-[11px] text-muted">{t("seasonsOf", { count: crops.length, max })}</span>
      </p>
      {/* `relative`: the crop list hangs from this grid, so it is wider than one picker */}
      <ol className="relative mt-1 grid grid-cols-1 gap-2 @[20rem]:grid-cols-2 @[40rem]:grid-cols-3">
        {crops.map((id, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            <span className="w-4 shrink-0 text-center font-mono text-[11px] text-muted" aria-hidden="true">{i + 1}</span>
            <CropCombobox label={`${label} ${i + 1}`} value={id} onChange={(v) => set(i, v)} />
            {crops.length > min && (
              <button type="button" onClick={() => remove(i)} aria-label={t("removeSeason", { n: i + 1 })} title={t("removeSeason", { n: i + 1 })}
                className="fs-btn fs-btn-quiet h-11 w-8 shrink-0 px-0 text-muted hover:text-danger"><Icon name="close" size={16} /></button>
            )}
          </li>
        ))}
        {crops.length < max && (
          <li>
            <button type="button" onClick={() => onChange([...crops, addId])} className="fs-btn fs-btn-quiet h-11 w-full justify-center border-dashed text-sm">
              <Icon name="plus" size={16} />{t("addSeason")}
            </button>
          </li>
        )}
      </ol>
      {crops.length === 0 && <p className="mt-1 text-xs text-muted">{t("noHistory")}</p>}
    </div>
  );
}
