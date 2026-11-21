// src/lib/popup-preview.ts
// Answers one question for the Milhaus Service pop-up: is the person
// looking at this page an admin? Used by ?popup on the live site (Terry's
// ask, 2026-11-21): Charlie couldn't see the pop-up again because it only
// shows once per visit, so an admin adding ?popup to any page address
// (e.g. www.milhaus.de/?popup) opens it straight away. For everyone else
// the answer is no and the page behaves normally — the check runs here on
// the server, so a visitor can't switch it on from their browser.

"use server";

import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function canPreviewPopup(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return isAdminRole(profile?.role);
}
