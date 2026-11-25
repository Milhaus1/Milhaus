// src/app/admin/events/[id]/page.tsx
// Admin → Events → Edit: change an event after it's been added. Added
// 2026-11-21 — events had never had an edit page, so Charlie couldn't fix
// a date or a typo without deleting and re-adding the event. Same fields
// as /admin/events/new, filled in with what's there now, plus controls to
// replace or remove the cover photo and remove individual pictures. The
// save is updateEvent in ../actions.ts (see there for how times are kept).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updateEvent } from "@/app/admin/events/actions";
import { EventTimeFields } from "@/app/admin/events/event-time-fields";
import { BASE_NAMES } from "@/lib/bases";
import { EVENT_CATEGORIES, EVENT_CATEGORY_ADMIN_LABELS } from "@/lib/events";
import { getEvent } from "@/lib/events-queries";
import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit event",
  robots: { index: false, follow: false },
};

const labelClass = "mb-1 block font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft/75";
const inputClass =
  "w-full rounded-md border border-canvas-deep bg-paper px-3 py-2 text-[0.95rem] text-charcoal placeholder:text-charcoal/40 focus:border-olive focus:outline-none";
const fileClass =
  "w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-canvas-deep file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink";

export default async function AdminEditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/admin/events/${id}`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) redirect("/");

  // Admins can read hidden events too (events RLS), so this finds any event.
  const event = await getEvent(id);
  if (!event) redirect("/admin/events");

  return (
    <main className="flex-1 py-14">
      <div className="mx-auto max-w-160 px-4 sm:px-8">
        <Link href="/admin/events" className="mb-6 inline-block text-sm text-ink-soft hover:text-ink">
          ← Back to events
        </Link>
        <h1 className="mb-2 font-display text-3xl font-semibold text-ink">Edit event</h1>
        <p className="mb-6 text-ink-soft">
          Change anything below and press Save changes. {event.isActive ? "It stays on the Events page." : "It's hidden at the moment — use Unhide on the Events list to show it."}
        </p>

        {saved && !error && (
          <p role="status" className="mb-6 rounded-md border border-olive/30 bg-olive/10 px-4 py-3 text-sm text-olive-deep">
            Saved.{" "}
            {event.isActive && (
              <a href={`/events/${event.id}`} className="font-semibold underline">
                View the event page
              </a>
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-6 rounded-md border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
            {error}
          </p>
        )}

        <form action={updateEvent} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={event.id} />

          <div>
            <label htmlFor="title" className={labelClass}>
              Title
            </label>
            <input id="title" name="title" required defaultValue={event.title} className={inputClass} />
          </div>

          <div>
            <label htmlFor="category" className={labelClass}>
              Category
            </label>
            <select id="category" name="category" required defaultValue={event.category ?? ""} className={inputClass}>
              <option value="" disabled>
                Choose a category…
              </option>
              {EVENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EVENT_CATEGORY_ADMIN_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={event.description ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="organizerName" className={labelClass}>
                Organizer name
              </label>
              <input
                id="organizerName"
                name="organizerName"
                defaultValue={event.organizerName}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ink-soft/75">
                Don&apos;t know who runs it? Leave this empty and the website&apos;s address is shown instead.
              </p>
            </div>
            <div>
              <label htmlFor="organizerUrl" className={labelClass}>
                Organizer link
              </label>
              <input
                id="organizerUrl"
                name="organizerUrl"
                type="url"
                defaultValue={event.organizerUrl ?? ""}
                placeholder="https://…"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClass}>
                City
              </label>
              <input id="city" name="city" required defaultValue={event.city} className={inputClass} />
            </div>
            <div>
              <label htmlFor="base" className={labelClass}>
                Nearest base
              </label>
              <select id="base" name="base" defaultValue={event.base ?? ""} className={inputClass}>
                <option value="">Not base-specific</option>
                {BASE_NAMES.map((base) => (
                  <option key={base} value={base}>
                    {base}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <EventTimeFields startsAt={event.startsAt} endsAt={event.endsAt} />

          <div>
            <label htmlFor="coverImage" className={labelClass}>
              Cover photo (optional)
            </label>
            {event.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- small preview of the current picture
              <img src={event.coverImageUrl} alt="" className="mb-2 h-28 w-full rounded-md border border-canvas-deep object-cover" />
            )}
            <input id="coverImage" name="coverImage" type="file" accept="image/*" className={fileClass} />
            <p className="mt-1 text-xs text-ink-soft/75">
              {event.coverImageUrl ? "Choose a file to replace it, or leave empty to keep it." : "None yet."}
            </p>
            {event.coverImageUrl && (
              <label className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" name="removeCover" className="h-3.5 w-3.5 rounded border-canvas-deep" />
                Remove the cover photo
              </label>
            )}
          </div>

          <div>
            <span className={labelClass}>More pictures</span>
            {event.photos.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {event.photos.map((url, index) => (
                  <label key={url} className="flex flex-col gap-1 text-xs text-ink-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element -- small preview of the current picture */}
                    <img src={url} alt={`Picture ${index + 1}`} className="aspect-square w-full rounded-md border border-canvas-deep object-cover" />
                    <span className="flex items-center gap-1.5">
                      <input type="checkbox" name="removePhoto" value={url} className="h-3.5 w-3.5 rounded border-canvas-deep" />
                      Remove
                    </span>
                  </label>
                ))}
              </div>
            )}
            <label htmlFor="photos" className="mb-1 block text-xs text-ink-soft">
              Add pictures (optional)
            </label>
            <input id="photos" name="photos" type="file" accept="image/*" multiple className={fileClass} />
          </div>

          <button
            type="submit"
            className="mt-2 w-fit rounded-md bg-brass px-5 py-2.5 text-sm font-semibold text-paper transition-[transform,box-shadow] hover:-translate-y-px hover:bg-brass-deep"
          >
            Save changes
          </button>
        </form>
      </div>
    </main>
  );
}
