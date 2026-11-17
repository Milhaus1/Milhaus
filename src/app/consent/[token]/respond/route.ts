// src/app/consent/[token]/respond/route.ts
// Where the Yes / No buttons on the consent page post to — a plain HTML
// form post, answered with a redirect back to the consent page, which
// then shows "Thanks — confirmed" (or "Noted").
//
// Why not the server action the buttons used before: on 2026-11-17 the
// very first real confirmation (Charlie's own test) saved correctly but
// left him on a white "Application error: a client-side exception has
// occurred" page. A server action redraws the page in the browser with
// JavaScript, and that redraw crashed in his browser. It worked in a
// clean Chrome; the suspect is the browser auto-translating the English
// page into German (which rewrites the page under React) or an email
// app's built-in browser. This page is opened by strangers from an email,
// in whatever browser that is, so it now needs no JavaScript at all: a
// normal form post and a fresh page load can't hit that crash.

import { NextResponse } from "next/server";
import { confirmConsent, declineConsent } from "@/app/consent/[token]/actions";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await request.formData();
  // The token comes from the URL; the actions read it from the form data.
  const data = new FormData();
  data.set("token", token);

  if (form.get("answer") === "yes") await confirmConsent(data);
  else if (form.get("answer") === "no") await declineConsent(data);

  // 303 so the browser follows with a GET — reloading the result page
  // never re-sends the answer.
  return NextResponse.redirect(new URL(`/consent/${encodeURIComponent(token)}`, request.url), 303);
}
