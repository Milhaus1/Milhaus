// src/lib/event-times.ts
// Event dates and times, always in German time. Charlie's report,
// 2026-11-25: "they show the time of day we posted them and not the times
// entered for the event", and a Christmas market that runs for weeks only
// showed on the calendar on its first day. Three causes, all fixed here
// and in the files that use this:
//
//  1. The Add/Edit forms used one combined date-and-time box. Picking a
//     day in Safari's calendar fills in the current time, so an event
//     added at 4:08 PM was saved as starting at 4:08 PM (Wintertraum and
//     Punschwald both were). The forms now have separate date and time
//     boxes, and the time box starts empty.
//  2. Times were saved "as typed" in UTC, then shown in whatever time zone
//     the server or the visitor's browser was in, so the same event showed
//     different times on different pages (an hour later on the cards for
//     visitors in Germany). Now a time is saved as the real moment in
//     German time (eventMoment) and always shown in German time
//     (EVENT_TIME_ZONE), wherever the visitor or the server is.
//  3. The calendar marked only an event's first day. eventDays lists every
//     day it runs, so each of them gets a dot and shows the event.
//
// No database imports, so the calendar (a browser component) can use it.
// src/lib/site-settings.ts has the same German-time maths for Charlie's
// promotion dates; it isn't shared because that file loads the database
// client, which can't run in the browser.

export const EVENT_TIME_ZONE = "Europe/Berlin";

/** How far German time is ahead of UTC at that moment, in ms (1 or 2 hours). */
function berlinOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EVENT_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The moment a German date ("YYYY-MM-DD") and time ("HH:mm") stand for,
 * or null if either is missing or not a real date/time. */
export function eventMoment(day: string | null | undefined, time: string | null | undefined): Date | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  const timeMatch = /^(\d{2}):(\d{2})/.exec(time ?? "");
  if (!dayMatch || !timeMatch) return null;
  const guess = Date.UTC(+dayMatch[1], +dayMatch[2] - 1, +dayMatch[3], +timeMatch[1], +timeMatch[2]);
  if (Number.isNaN(guess)) return null;
  const first = guess - berlinOffsetMs(guess);
  return new Date(guess - berlinOffsetMs(first));
}

/** The German day ("YYYY-MM-DD") a moment falls on. */
export function eventDay(moment: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE }).format(new Date(moment));
}

/** The German time ("HH:mm") of a moment, for filling the form's time box. */
export function eventTime(moment: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(moment));
}

/** Midnight (German time) at the start of a "YYYY-MM-DD" day. */
export function eventDayStart(day: string): Date {
  return eventMoment(day, "00:00") ?? new Date(NaN);
}

/** A "YYYY-MM-DD" day plus some days, by the calendar (no time zones). */
export function addDays(day: string, count: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10);
}

/** Every German day an event runs on, first to last. One day when it has
 * no end. Capped at a year so a mistyped end date can't fill thousands of
 * calendar days. */
export function eventDays(startsAt: string, endsAt: string | null): string[] {
  const first = eventDay(startsAt);
  const last = endsAt ? eventDay(endsAt) : first;
  const days = [first];
  while (days.length < 366 && days[days.length - 1] < last) days.push(addDays(days[days.length - 1], 1));
  return days;
}

/** Does the event run on more than one day? */
export function isMultiDay(startsAt: string, endsAt: string | null): boolean {
  return endsAt !== null && eventDay(endsAt) !== eventDay(startsAt);
}
