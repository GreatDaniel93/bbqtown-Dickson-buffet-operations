import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/book",
  "/book.html",
  "/staff-login",
  "/api/admin/auth",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
]);

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hasStaffSession(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const supplied = request.cookies.get("bbqtown_admin")?.value;
  if (!secret || !supplied) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("bbqtown-dickson-admin-v1")));
  return supplied === expected;
}

function isPublic(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || pathname === "/api/bookings" || pathname.startsWith("/api/bookings/");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (await hasStaffSession(request)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Staff sign-in required" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/staff-login";
  login.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(login);
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
