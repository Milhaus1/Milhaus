// src/app/admin/events/actions.ts
// Create/edit/toggle/delete for the Events calendar — Charlie hand-enters
// every event himself (his ask, via Terry: no self-serve submission, no
// review queue, modeled on the businesses directory but without its
// consent-verification system — this is public event info Charlie is
// choosing to publish, not a third party's private contact details).
// Authorization is enforced by the events RLS policies (admin-only
// writes), not re-checked here — same pattern as the businesses actions.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isEventCategory } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

function revalidateEventPaths() {
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

async function uploadEventImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  file: File,
  name: string,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `_events/${eventId}/${name}.${ext}`;
  // Plain insert, not upsert — every path here is fresh (edits add a
  // timestamp to the name, see updateEvent), and the storage policy
  // permitting this write is insert-only (see
  // 20261014110000_add_events_storage_policy.sql).
  const { error } = await supabase.storage.from("listing-photos").upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
  return data.publicUrl;
}

/** Admin → Events → Add an event, with optional cover image and photos. */
export async function createEvent(formData: FormData) {
  const title = (formData.get("title") as string | null)?.trim();
  const organizerName = (formData.get("organizerName") as string | null)?.trim();
  const city = (formData.get("city") as string | null)?.trim();
  const startsAtRaw = formData.get("startsAt") as string | null;
  if (!title) throw new Error("Title is required.");
  if (!organizerName) throw new Error("Organizer name is required.");
  if (!city) throw new Error("City is required.");
  if (!startsAtRaw) throw new Error("Start date/time is required.");
  // Required for new events (Charlie's categories ask, 2026-11-09), so
  // every new event shows up under one of the /events "Type" filters.
  const category = formData.get("category");
  if (!isEventCategory(category)) throw new Error("Choose a category.");

  const supabase = await createClient();
  const eventId = crypto.randomUUID();

  const coverFile = formData.get("coverImage") as File | null;
  const coverImageUrl = coverFile ? await uploadEventImage(supabase, eventId, coverFile, "cover") : null;

  const photoFiles = formData.getAll("photos") as File[];
  const photos: string[] = [];
  for (const [index, file] of photoFiles.entries()) {
    const url = await uploadEventImage(supabase, eventId, file, `photo-${index + 1}`);
    if (url) photos.push(url);
  }

  const endsAtRaw = formData.get("endsAt") as string | null;

  const { error } = await supabase.from("events").insert({
    id: eventId,
    title,
    description: (formData.get("description") as string | null) || null,
    organizer_name: organizerName,
    organizer_url: (formData.get("organizerUrl") as string | null) || null,
    city,
    base: (formData.get("base") as string | null) || null,
    category,
    starts_at: new Date(startsAtRaw).toISOString(),
    ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
    cover_image_url: coverImageUrl,
    photos,
  });

  if (error) throw new Error(error.message);

  revalidateEventPaths();
}

/** Admin → Events → Edit (/admin/events/[id]). Added 2026-11-21: events
 * had never had an edit page — Terry found Charlie couldn't change one
 * after adding it. Every field from the Add form, plus: replace or remove
 * the cover photo, remove individual pictures, add more. Removed pictures
 * are only dropped from the event; the files stay in storage (the events
 * storage policy is insert-only, and an orphaned picture costs nothing).
 *
 * Times: the form's date/time is stored as typed and shown back as typed,
 * with no timezone conversion — the same as createEvent on Vercel, whose
 * servers run on UTC. Parsed here as UTC explicitly, so an edit saved from
 * any server keeps the event at the time Charlie entered. */
export async function updateEvent(formData: FormData) {
  const id = formData.get("id") as string;
  const back = `/admin/events/${id}`;
  const fail = (message: string): never => redirect(`${back}?error=${encodeURIComponent(message)}`);

  const title = (formData.get("title") as string | null)?.trim();
  const organizerName = (formData.get("organizerName") as string | null)?.trim();
  const city = (formData.get("city") as string | null)?.trim();
  const startsAtRaw = formData.get("startsAt") as string | null;
  const endsAtRaw = formData.get("endsAt") as string | null;
  const category = formData.get("category");
  if (!title) fail("Title is required.");
  if (!organizerName) fail("Organizer name is required.");
  if (!city) fail("City is required.");
  if (!startsAtRaw) fail("Start date/time is required.");
  if (!isEventCategory(category)) fail("Choose a category.");
  const startsAt = new Date(`${startsAtRaw}Z`);
  const endsAt = endsAtRaw ? new Date(`${endsAtRaw}Z`) : null;
  if (endsAt && endsAt < startsAt) fail("The end can't be before the start.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("events").select("photos, cover_image_url").eq("id", id).maybeSingle();
  if (!current) fail("That event no longer exists, or you're not signed in as an admin.");

  // New file names on every edit: Supabase's CDN keeps serving the old
  // picture at a reused path.
  const stamp = Date.now();
  let coverImageUrl: string | null = current!.cover_image_url;
  const coverFile = formData.get("coverImage") as File | null;
  if (coverFile && coverFile.size > 0) {
    coverImageUrl = await uploadEventImage(supabase, id, coverFile, `cover-${stamp}`);
  } else if (formData.get("removeCover") === "on") {
    coverImageUrl = null;
  }

  const removed = new Set(formData.getAll("removePhoto") as string[]);
  const photos = ((current!.photos as string[] | null) ?? []).filter((url) => !removed.has(url));
  for (const [index, file] of (formData.getAll("photos") as File[]).entries()) {
    const url = await uploadEventImage(supabase, id, file, `photo-${stamp}-${index + 1}`);
    if (url) photos.push(url);
  }

  const { data: saved, error } = await supabase
    .from("events")
    .update({
      title,
      description: (formData.get("description") as string | null)?.trim() || null,
      organizer_name: organizerName,
      organizer_url: (formData.get("organizerUrl") as string | null)?.trim() || null,
      city,
      base: (formData.get("base") as string | null) || null,
      category,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      cover_image_url: coverImageUrl,
      photos,
    })
    .eq("id", id)
    .select("id");
  if (error) fail(error.message);
  if (!saved?.length) fail("That didn't save — you may need to sign in again.");

  revalidateEventPaths();
  revalidatePath(`/events/${id}`);
  redirect(`${back}?saved=1`);
}

/** Admin → Events → the Category picker on each row. The ones added
 * before categories existed (2026-11-09) start with none — this is the
 * quick way to set one without opening Edit. */
export async function setEventCategory(formData: FormData) {
  const id = formData.get("id") as string;
  const category = formData.get("category");
  if (!isEventCategory(category)) throw new Error("Choose a category.");

  const supabase = await createClient();
  // .select("id") so a save that changed nothing (signed out, or not an
  // admin — RLS just skips the row, no error) reports that instead of
  // the picker saying "✓ Saved". Same check as src/app/admin/users/actions.ts.
  const { data, error } = await supabase.from("events").update({ category }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("That didn't save — you may need to sign in again.");
  }

  revalidateEventPaths();
}

/** Admin → Events → "Hide" / "Unhide" on the public calendar. */
export async function toggleEventActive(formData: FormData) {
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidateEventPaths();
}

/** Admin → Events → "Delete". */
export async function deleteEvent(formData: FormData) {
  const id = formData.get("id") as string;

  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateEventPaths();
}
