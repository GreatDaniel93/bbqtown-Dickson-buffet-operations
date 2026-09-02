import { NextResponse } from "next/server";
import { configured, loginCookie, verifyPin } from "../../api/_lib/admin-auth";

function safeNext(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "/";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  const base = new URL(request.url);

  if (!configured() || !verifyPin(String(form.get("pin") || ""))) {
    base.pathname = "/staff-login";
    base.search = `?next=${encodeURIComponent(next)}&error=1`;
    return NextResponse.redirect(base, 303);
  }

  base.pathname = next;
  base.search = "";
  const response = NextResponse.redirect(base, 303);
  response.headers.set("Set-Cookie", loginCookie());
  return response;
}
