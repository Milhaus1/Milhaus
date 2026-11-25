// src/components/radius-choice.tsx
// "Distance from the base: 30 km | 50 km" — the choice at the top of every
// page's Base filter (Homes, Cars, Services, Events). Terry's ask,
// 2026-11-25: filter by a 30–50 km radius around each base, on every page
// that needs it. The distances and the default live in src/lib/bases.ts.

"use client";

import { useTranslations } from "next-intl";
import { RADIUS_OPTIONS_KM } from "@/lib/bases";

export function RadiusChoice({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  const t = useTranslations("RadiusChoice");
  return (
    <fieldset>
      <legend className="mb-1.5 block font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft/75">
        {t("label")}
      </legend>
      <div className="flex gap-2">
        {RADIUS_OPTIONS_KM.map((km) => (
          <label
            key={km}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-canvas-deep px-3 py-1.5 text-sm text-charcoal has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-olive"
          >
            <input
              type="radio"
              value={km}
              checked={value === km}
              onChange={() => onChange(km)}
              className="sr-only"
            />
            {t("option", { km })}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
