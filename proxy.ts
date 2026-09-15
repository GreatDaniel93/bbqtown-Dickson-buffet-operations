import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/book",
  "/book.html",
  "/manage-booking.html",
  "/voucher",
  "/voucher/claim",
  "/street-voucher-poster.html",
  "/street-voucher-qr.svg",
  "/bbqtown-logo.png",
  "/bbqtown-logo.svg",
  "/robots.txt",
  "/sitemap.xml",
  "/staff-login",
  "/staff-login/submit",
  "/api/admin/auth",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
]);

const PUBLIC_BOOKING_IMAGES = new Set([
  "/images/bbq-meat-display.jpg",
  "/images/bbq-sides.jpg",
  "/images/bbq-selection.jpg",
  "/images/bbq-hot-food.jpg",
  "/images/bbq-fried-food.jpg",
]);

const LEGACY_ANDROID_BYPASS_UNTIL = Date.UTC(2026, 8, 22, 0, 0, 0);

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function hasStaffSession(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const supplied = request.cookies.get("bbqtown_admin")?.value;
  if (!secret || !supplied) return false;
  const expected = await hmacHex(secret, "bbqtown-dickson-admin-v1");
  return supplied === expected;
}

async function hasValidDeviceAccess(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  const token = request.headers.get("x-bbqtown-device-token") || "";
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacHex(secret, payload);
  if (signature !== expected) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    const data = JSON.parse(json) as { deviceId?: string; exp?: number };
    return Boolean(data.deviceId && Number(data.exp || 0) > Date.now());
  } catch {
    return false;
  }
}

function isPublic(pathname: string) {
  return pathname.startsWith("/_next/") || PUBLIC_PATHS.has(pathname) || PUBLIC_BOOKING_IMAGES.has(pathname) || pathname === "/api/vouchers/claim" || pathname === "/api/bookings" || pathname.startsWith("/api/bookings/");
}

function isLegacyOpsAndroid(request: NextRequest) {
  return Date.now() < LEGACY_ANDROID_BYPASS_UNTIL && (request.headers.get("user-agent")?.includes("BBQTownOpsAndroid") ?? false);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Pairing and refresh heartbeats authenticate themselves in their route handlers.
  if (pathname === "/api/ops/device/pair" && request.method === "POST") return NextResponse.next();
  if (pathname === "/api/ops/devices" && request.method === "POST") return NextResponse.next();

  if (pathname.startsWith("/api/ops/") && await hasValidDeviceAccess(request)) {
    return NextResponse.next();
  }

  // Short migration window so alpha5.10 tablets keep running while alpha5.11 is installed.
  // This fallback expires automatically on 22 Sep 2026.
  if (pathname.startsWith("/api/ops/") && isLegacyOpsAndroid(request)) {
    return NextResponse.next();
  }

  const staffSignedIn = await hasStaffSession(request);
  if (staffSignedIn) {
    if (
      pathname === "/ops.html" &&
      request.nextUrl.searchParams.get("full") !== "1"
    ) {
      const staffHub = request.nextUrl.clone();
      staffHub.pathname = "/staff.html";
      staffHub.search = "";
      return NextResponse.redirect(staffHub);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Staff or paired-device authentication required" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/staff-login";
  login.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
