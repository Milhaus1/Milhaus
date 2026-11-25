// src/app/admin/events/event-time-fields.tsx
// The "when" part of Admin → Events → Add and Edit: separate date and time
// boxes for the start and the end. Until 2026-11-25 each was one combined
// date-and-time box, and picking a day in Safari filled in the current
// time, so events showed the time Charlie posted them (Charlie's report,
// 2026-11-25; the full story is in src/lib/event-times.ts). The time boxes
// here start empty and the start time must be typed in. Times are German
// time (readEventTimes in ./actions.ts).

import { eventDay, eventTime } from "@/lib/event-times";

const labelClass = "mb-1 block font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft/75";
const inputClass =
  "w-full rounded-md border border-canvas-deep bg-paper px-3 py-2 text-[0.95rem] text-charcoal placeholder:text-charcoal/40 focus:border-olive focus:outline-none";

export function EventTimeFields({ startsAt, endsAt }: { startsAt?: string | null; endsAt?: string | null }) {
  // Only fill in the end date when it's a different day from the start —
  // a one-day event's end shows as just its time.
  const endDate = endsAt && startsAt && eventDay(endsAt) !== eventDay(startsAt) ? eventDay(endsAt) : "";

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">When</legend>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className={labelClass}>
            Starts — date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={startsAt ? eventDay(startsAt) : ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="startTime" className={labelClass}>
            Starts — time
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            defaultValue={startsAt ? eventTime(startsAt) : ""}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="endDate" className={labelClass}>
            Last day (optional)
          </label>
          <input id="endDate" name="endDate" type="date" defaultValue={endDate} className={inputClass} />
        </div>
        <div>
          <label htmlFor="endTime" className={labelClass}>
            Ends — time (optional)
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={endsAt ? eventTime(endsAt) : ""}
            className={inputClass}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-ink-soft/75">
        German time. For a one-day event, leave &ldquo;Last day&rdquo; empty and just add the end time. For a
        market or festival that runs for several days, enter its last day too — it then shows on every day in
        between on the calendar.
      </p>
    </fieldset>
  );
}
